"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendSmsViaTwilio } from "@/lib/sms/client";

export async function updateSmsOptIn(optIn: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const { error } = await supabase
    .from("profiles")
    .update({ sms_opt_in: optIn })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings/sms");
  return { ok: true };
}

export async function sendChurchSms(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile?.org_id) return { error: "No organization" };

  const to = String(formData.get("to") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!to || !body) return { error: "Phone and message required" };

  const { data: inserted, error: insErr } = await supabase
    .from("sms_messages")
    .insert({
      org_id: profile.org_id,
      to_phone: to,
      body,
      status: "queued",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insErr || !inserted) return { error: insErr?.message ?? "Log failed" };

  const result = await sendSmsViaTwilio({ to, body });
  if (!result.ok) {
    await supabase
      .from("sms_messages")
      .update({ status: "failed", error: result.error })
      .eq("id", inserted.id);
    return { error: result.error };
  }

  await supabase
    .from("sms_messages")
    .update({
      status: "sent",
      provider_id: result.providerId ?? null,
      sent_at: new Date().toISOString(),
    })
    .eq("id", inserted.id);

  revalidatePath("/dashboard/settings/sms");
  return { ok: true };
}
