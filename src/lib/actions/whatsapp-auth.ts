"use server";

import { createHash, randomInt } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneE164 } from "@/lib/auth/phone";
import {
  orgAllowsWhatsappAuth,
  readOrgAuthMode,
  type OrgAuthMode,
} from "@/lib/platform/org-auth-mode";
import { sendWhatsappOtpMessage } from "@/lib/whatsapp/client";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashOtp(code: string, phone: string, orgId: string): string {
  return createHash("sha256").update(`${code}:${phone}:${orgId}`).digest("hex");
}

function syntheticEmailForPhone(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `wa+${digits}@auth.chms.local`;
}

async function loadParishBySlug(slug: string) {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("get_parish_public_by_slug", {
    _slug: slug,
  });
  if (error || !rows?.length) return { error: "Invalid or inactive parish link." } as const;
  const row = rows[0] as {
    id: string;
    display_name: string | null;
    auth_mode: OrgAuthMode;
  };
  return {
    orgId: row.id,
    parishName: row.display_name ?? slug,
    authMode: row.auth_mode ?? readOrgAuthMode(null),
  } as const;
}

async function establishSessionForUserId(userId: string) {
  const admin = createAdminClient();
  const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userRes.user?.email) {
    return { error: userErr?.message ?? "User not found" } as const;
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: userRes.user.email,
  });
  if (linkErr || !linkData.properties?.hashed_token) {
    return { error: linkErr?.message ?? "Could not start session" } as const;
  }

  const supabase = await createClient();
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr) return { error: verifyErr.message } as const;
  return { ok: true } as const;
}

export async function sendWhatsappAuthOtp(input: {
  parishSlug: string;
  phone: string;
  purpose: "login" | "signup";
  metadata?: Record<string, string | null | undefined>;
}) {
  const parish = await loadParishBySlug(input.parishSlug);
  if ("error" in parish) return parish;

  if (!orgAllowsWhatsappAuth(parish.authMode)) {
    return { error: "This parish does not use WhatsApp sign-in." };
  }

  const phoneE164 = normalizePhoneE164(input.phone);
  if (!phoneE164) return { error: "Enter a valid phone number." };

  const admin = createAdminClient();

  if (input.purpose === "login") {
    const { data: profileId, error: findErr } = await admin.rpc("find_profile_id_by_phone_in_org", {
      _org_id: parish.orgId,
      _phone_e164: phoneE164,
    });
    if (findErr) return { error: findErr.message };
    if (!profileId) {
      return {
        error: "No account found for this number in this parish. Create an account first.",
      };
    }
  }

  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error: insertErr } = await admin.from("auth_phone_otp_challenges").insert({
    org_id: parish.orgId,
    parish_slug: input.parishSlug.toLowerCase().trim(),
    phone_e164: phoneE164,
    code_hash: hashOtp(code, phoneE164, parish.orgId),
    purpose: input.purpose,
    metadata: input.metadata ?? {},
    expires_at: expiresAt,
  });
  if (insertErr) return { error: insertErr.message };

  const sent = await sendWhatsappOtpMessage({
    toE164: phoneE164,
    code,
    parishName: parish.parishName,
  });
  if (!sent.ok) return { error: sent.error };

  return { ok: true, phoneE164 };
}

export async function verifyWhatsappAuthOtp(input: {
  parishSlug: string;
  phone: string;
  code: string;
  purpose: "login" | "signup";
  signup?: {
    fullName: string;
    offeringNumber?: string | null;
    contactEmail?: string | null;
  };
}) {
  const parish = await loadParishBySlug(input.parishSlug);
  if ("error" in parish) return parish;

  if (!orgAllowsWhatsappAuth(parish.authMode)) {
    return { error: "This parish does not use WhatsApp sign-in." };
  }

  const phoneE164 = normalizePhoneE164(input.phone);
  if (!phoneE164) return { error: "Enter a valid phone number." };

  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from WhatsApp." };

  const admin = createAdminClient();
  const { data: challenge, error: chErr } = await admin
    .from("auth_phone_otp_challenges")
    .select("id, code_hash, expires_at, attempts, purpose")
    .eq("org_id", parish.orgId)
    .eq("phone_e164", phoneE164)
    .eq("purpose", input.purpose)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (chErr || !challenge) return { error: "No active code. Request a new one." };

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return { error: "Code expired. Request a new one." };
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    return { error: "Too many attempts. Request a new code." };
  }

  const expected = hashOtp(code, phoneE164, parish.orgId);
  const valid = expected === challenge.code_hash;

  await admin
    .from("auth_phone_otp_challenges")
    .update({ attempts: (challenge.attempts ?? 0) + 1 })
    .eq("id", challenge.id);

  if (!valid) return { error: "Incorrect code." };

  let userId: string | null = null;

  if (input.purpose === "login") {
    const { data: profileId, error: findErr } = await admin.rpc("find_profile_id_by_phone_in_org", {
      _org_id: parish.orgId,
      _phone_e164: phoneE164,
    });
    if (findErr) return { error: findErr.message };
    if (!profileId) return { error: "Account not found for this number." };
    userId = profileId as string;
  } else {
    const signup = input.signup;
    if (!signup?.fullName?.trim()) return { error: "Full name is required." };

    const { data: existingId } = await admin.rpc("find_profile_id_by_phone_in_org", {
      _org_id: parish.orgId,
      _phone_e164: phoneE164,
    });
    if (existingId) {
      return { error: "An account already exists for this number. Sign in instead." };
    }

    const email = syntheticEmailForPhone(phoneE164);
    const contactEmail = signup.contactEmail?.trim().toLowerCase() || null;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      phone: phoneE164,
      phone_confirm: true,
      user_metadata: {
        full_name: signup.fullName.trim(),
        phone: phoneE164,
        parish_slug: input.parishSlug.toLowerCase().trim(),
        offering_number: signup.offeringNumber?.trim() || null,
        contact_email: contactEmail,
        auth_channel: "whatsapp",
      },
    });
    if (createErr) return { error: createErr.message };
    userId = created.user?.id ?? null;
    if (!userId) return { error: "Could not create account." };
  }

  const session = await establishSessionForUserId(userId);
  if ("error" in session) return session;

  return { ok: true };
}
