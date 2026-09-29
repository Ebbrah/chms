"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizePhoneE164 } from "@/lib/auth/phone";
import { sendWhatsappTextMessage, isWhatsappConfigured } from "@/lib/whatsapp/client";

const REVALIDATE_PATH = "/dashboard/settings/whatsapp";

async function requireOrgSender() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" } as const;

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile?.org_id) return { error: "No organization" } as const;

  if (!isWhatsappConfigured()) {
    return {
      error:
        "WhatsApp is not configured on the server (META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID).",
    } as const;
  }

  return { supabase, userId: user.id, orgId: profile.org_id } as const;
}

async function collectParishPhoneNumbers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<string[]> {
  const seen = new Set<string>();

  const [{ data: members }, { data: profiles }] = await Promise.all([
    supabase.from("members").select("phone").eq("org_id", orgId).eq("status", "active"),
    supabase.from("profiles").select("phone").eq("org_id", orgId),
  ]);

  for (const row of [...(members ?? []), ...(profiles ?? [])]) {
    const normalized = normalizePhoneE164(String(row.phone ?? ""));
    if (normalized) seen.add(normalized);
  }

  return [...seen];
}

async function logAndSendWhatsapp(params: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
  userId: string;
  toE164: string;
  body: string;
  broadcastId?: string | null;
}) {
  const { data: inserted, error: insErr } = await params.supabase
    .from("whatsapp_messages")
    .insert({
      org_id: params.orgId,
      to_phone: params.toE164,
      body: params.body,
      status: "queued",
      created_by: params.userId,
      broadcast_id: params.broadcastId ?? null,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    return { ok: false as const, error: insErr?.message ?? "Log failed" };
  }

  const result = await sendWhatsappTextMessage({
    toE164: params.toE164,
    body: params.body,
  });

  if (!result.ok) {
    await params.supabase
      .from("whatsapp_messages")
      .update({ status: "failed", error: result.error })
      .eq("id", inserted.id);
    return { ok: false as const, error: result.error };
  }

  await params.supabase
    .from("whatsapp_messages")
    .update({
      status: "sent",
      provider_id: result.providerId ?? null,
      sent_at: new Date().toISOString(),
    })
    .eq("id", inserted.id);

  return { ok: true as const };
}

export async function sendParishWhatsapp(formData: FormData) {
  const ctx = await requireOrgSender();
  if ("error" in ctx) return ctx;

  const toRaw = String(formData.get("to") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!toRaw || !body) return { error: "Phone and message required" };

  const toE164 = normalizePhoneE164(toRaw);
  if (!toE164) return { error: "Enter a valid phone number." };

  const result = await logAndSendWhatsapp({
    supabase: ctx.supabase,
    orgId: ctx.orgId,
    userId: ctx.userId,
    toE164,
    body,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath(REVALIDATE_PATH);
  return { ok: true };
}

export async function broadcastParishWhatsapp(formData: FormData) {
  const ctx = await requireOrgSender();
  if ("error" in ctx) return ctx;

  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Message required" };
  if (body.length > 4096) return { error: "Message is too long for WhatsApp." };

  const recipients = await collectParishPhoneNumbers(ctx.supabase, ctx.orgId);
  if (recipients.length === 0) {
    return { error: "No member phone numbers found. Add phones on member or profile records." };
  }

  const broadcastId = randomUUID();
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const toE164 of recipients) {
    const result = await logAndSendWhatsapp({
      supabase: ctx.supabase,
      orgId: ctx.orgId,
      userId: ctx.userId,
      toE164,
      body,
      broadcastId,
    });
    if (result.ok) sent += 1;
    else {
      failed += 1;
      if (errors.length < 5 && result.error) errors.push(`${toE164}: ${result.error}`);
    }
  }

  revalidatePath(REVALIDATE_PATH);
  return {
    ok: true,
    total: recipients.length,
    sent,
    failed,
    errors,
    broadcastId,
  };
}
