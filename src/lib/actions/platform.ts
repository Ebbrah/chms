"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/auth/session";
import {
  DEFAULT_ORG_FEATURES,
  type OrgFeatureKey,
  type OrgFeatureFlags,
} from "@/lib/platform/org-features";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  if (!(await isPlatformAdmin())) return { error: "Platform admin only" } as const;
  return { ok: true } as const;
}

function parseDataUrlImage(
  dataUrl: string,
): { contentType: string; bytes: Uint8Array; extension: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  let extension = "jpg";
  if (contentType.includes("png")) extension = "png";
  else if (contentType.includes("webp")) extension = "webp";
  else if (contentType.includes("gif")) extension = "gif";
  return { contentType, bytes, extension };
}

function normalizeSlug(raw: string) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fiscalYearDates(startMonth: number) {
  const now = new Date();
  const year =
    now.getMonth() + 1 >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
  const start = new Date(year, startMonth - 1, 1);
  const end = new Date(year + 1, startMonth - 1, 0);
  const label = `FY ${year}/${String(year + 1).slice(-2)}`;
  return {
    label,
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export async function createDiocese(formData: FormData) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");

  if (!name || !code) return { error: "Name and code are required" };

  const { error } = await supabase.from("dioceses").insert({ name, code });
  if (error) return { error: error.message };

  revalidatePath("/platform/dioceses");
  revalidatePath("/platform/districts");
  revalidatePath("/platform/parishes/new");
  return { ok: true };
}

export async function createDistrict(formData: FormData) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  const supabase = await createClient();
  const dioceseId = String(formData.get("diocese_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");

  if (!dioceseId || !name || !code) return { error: "Dayosisi, name, and code are required" };

  const { error } = await supabase.from("districts").insert({
    diocese_id: dioceseId,
    name,
    code,
  });
  if (error) return { error: error.message };

  revalidatePath("/platform/districts");
  revalidatePath("/platform/districts/new");
  revalidatePath("/platform/parishes/new");
  revalidatePath("/platform");
  return { ok: true };
}

export async function provisionParish(formData: FormData) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  const supabase = await createClient();
  const districtId = String(formData.get("district_id") ?? "").trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const slug = normalizeSlug(String(formData.get("slug") ?? displayName));
  const timezone = String(formData.get("timezone") ?? "Africa/Dar_es_Salaam").trim();
  const fiscalStartMonth = Number(formData.get("fiscal_year_start_month") ?? 1);
  const dioceseName = String(formData.get("diocese_name") ?? "").trim();
  const postalBox = String(formData.get("postal_box") ?? "").trim();
  const logoDataUrl = String(formData.get("logo_data_url") ?? "").trim();
  const firstAdminEmail = String(formData.get("first_admin_email") ?? "")
    .trim()
    .toLowerCase();

  if (!districtId || !displayName || !slug) {
    return { error: "Jimbo, parish name, and slug are required" };
  }

  const fiscal = fiscalYearDates(
    Number.isFinite(fiscalStartMonth) && fiscalStartMonth >= 1 && fiscalStartMonth <= 12
      ? fiscalStartMonth
      : 1,
  );

  const { data: orgId, error } = await supabase.rpc("provision_parish", {
    _district_id: districtId,
    _display_name: displayName,
    _slug: slug,
    _timezone: timezone,
    _fiscal_label: fiscal.label,
    _fiscal_start: fiscal.start,
    _fiscal_end: fiscal.end,
    _church_name: displayName,
    _diocese_name: dioceseName || null,
    _postal_box: postalBox || null,
  });

  if (error) return { error: error.message };
  if (!orgId) return { error: "Parish provisioning failed" };

  const updates: Record<string, unknown> = {
    fiscal_year_start_month: fiscalStartMonth,
  };

  if (logoDataUrl) {
    const parsed = parseDataUrlImage(logoDataUrl);
    if (parsed) {
      const path = `${orgId}/logo-${Date.now()}.${parsed.extension}`;
      const upload = await supabase.storage
        .from("certificate-assets")
        .upload(path, parsed.bytes, { contentType: parsed.contentType, upsert: true });
      if (!upload.error) {
        const { data: publicData } = supabase.storage.from("certificate-assets").getPublicUrl(path);
        updates.logo_url = publicData.publicUrl;
      }
    }
  }

  const { error: updateErr } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", orgId);
  if (updateErr) return { error: updateErr.message };

  if (firstAdminEmail) {
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", firstAdminEmail)
      .maybeSingle();

    if (adminProfile?.id) {
      await supabase.rpc("transfer_user_to_parish", {
        _user_id: adminProfile.id,
        _to_org_id: orgId,
        _reason: "Initial parish administrator",
      });
      await supabase.from("user_roles").upsert(
        { user_id: adminProfile.id, org_id: orgId, role: "admin" },
        { onConflict: "user_id,org_id,role" },
      );
    }
  }

  revalidatePath("/platform/parishes");
  revalidatePath("/platform");
  redirect(`/platform/parishes/${orgId}?created=1`);
}

export async function updateParishFeatures(orgId: string, features: OrgFeatureFlags) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  const payload: Partial<Record<OrgFeatureKey, boolean>> = {};
  for (const key of Object.keys(DEFAULT_ORG_FEATURES) as OrgFeatureKey[]) {
    if (typeof features[key] === "boolean") payload[key] = features[key];
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_org_features", {
    _org_id: orgId,
    _features: payload,
  });
  if (error) return { error: error.message };

  revalidatePath(`/platform/parishes/${orgId}`);
  return { ok: true };
}

export async function setParishStatus(orgId: string, status: "active" | "suspended") {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_parish_status", {
    _org_id: orgId,
    _status: status,
  });
  if (error) return { error: error.message };

  revalidatePath(`/platform/parishes/${orgId}`);
  revalidatePath("/platform/parishes");
  revalidatePath("/platform");
  return { ok: true };
}

export async function assignParishOperator(orgId: string, email: string) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return { error: "Email is required" };

  const supabase = await createClient();
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (profileErr) return { error: profileErr.message };
  const userId = profile?.id;

  if (!userId) {
    return {
      error: "No account found for that email. Ask them to sign up first, then assign again.",
    };
  }

  const { error } = await supabase.from("platform_parish_operators").upsert(
    { user_id: userId, org_id: orgId },
    { onConflict: "user_id,org_id" },
  );
  if (error) return { error: error.message };

  revalidatePath(`/platform/parishes/${orgId}`);
  return { ok: true };
}

export async function removeParishOperator(orgId: string, userId: string) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_parish_operators")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath(`/platform/parishes/${orgId}`);
  return { ok: true };
}

export async function setOperatorContext(orgId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_operator_context_org", {
    _org_id: orgId,
  });
  if (error) return { error: error.message };

  revalidatePath("/platform");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateParishLogo(orgId: string, formData: FormData) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  const dataUrl = String(formData.get("logo_data_url") ?? "").trim();
  if (!dataUrl) return { error: "Please choose an image" };
  const parsed = parseDataUrlImage(dataUrl);
  if (!parsed) return { error: "Invalid image format" };

  const supabase = await createClient();
  const path = `${orgId}/logo-${Date.now()}.${parsed.extension}`;
  const upload = await supabase.storage
    .from("certificate-assets")
    .upload(path, parsed.bytes, { contentType: parsed.contentType, upsert: true });
  if (upload.error) return { error: upload.error.message };

  const { data: publicData } = supabase.storage.from("certificate-assets").getPublicUrl(path);
  const { error } = await supabase
    .from("organizations")
    .update({ logo_url: publicData.publicUrl })
    .eq("id", orgId);
  if (error) return { error: error.message };

  revalidatePath(`/platform/parishes/${orgId}`);
  return { ok: true, logoUrl: publicData.publicUrl };
}

export async function transferParishMember(
  userEmail: string,
  toOrgId: string,
  reason: string,
) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate;

  const email = userEmail.trim().toLowerCase();
  if (!email || !toOrgId) return { error: "Email and target parish are required" };

  const supabase = await createClient();
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name")
    .ilike("email", email)
    .maybeSingle();

  if (profileErr) return { error: profileErr.message };
  if (!profile?.id) return { error: "No account found for that email" };

  const { error } = await supabase.rpc("transfer_user_to_parish", {
    _user_id: profile.id,
    _to_org_id: toOrgId,
    _reason: reason.trim() || "Platform admin transfer",
  });
  if (error) return { error: error.message };

  revalidatePath("/platform/transfers");
  revalidatePath(`/platform/parishes/${toOrgId}`);
  return { ok: true, userName: profile.full_name };
}
