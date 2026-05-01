"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createOfferingType(formData: FormData) {
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

  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Name required" };
  const { data: existing } = await supabase
    .from("offering_types")
    .select("id")
    .eq("org_id", profile.org_id)
    .ilike("name", name)
    .maybeSingle();
  if (existing?.id) return { error: "Offering type already exists" };

  const { error } = await supabase.from("offering_types").insert({
    org_id: profile.org_id,
    name,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/offerings");
  return { ok: true };
}

export async function updateOfferingType(formData: FormData) {
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

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!id || !name) return { error: "Type id and name are required" };

  const { data: existing } = await supabase
    .from("offering_types")
    .select("id")
    .eq("org_id", profile.org_id)
    .ilike("name", name)
    .neq("id", id)
    .maybeSingle();
  if (existing?.id) return { error: "Offering type already exists" };

  const { error } = await supabase
    .from("offering_types")
    .update({ name })
    .eq("id", id)
    .eq("org_id", profile.org_id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/offerings");
  return { ok: true };
}

export async function deleteOfferingType(id: string) {
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
  if (!id.trim()) return { error: "Type id required" };

  const { data: linkedOffering } = await supabase
    .from("offerings")
    .select("id")
    .eq("org_id", profile.org_id)
    .eq("offering_type_id", id)
    .limit(1)
    .maybeSingle();
  if (linkedOffering?.id) {
    return { error: "Cannot delete offering type that is already used in offerings" };
  }

  const { error } = await supabase
    .from("offering_types")
    .delete()
    .eq("id", id)
    .eq("org_id", profile.org_id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/offerings");
  return { ok: true };
}

export async function createOffering(formData: FormData) {
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

  const offering_type_id = String(formData.get("offering_type_id") || "");
  const amount = Number(formData.get("amount"));
  const member_id = String(formData.get("member_id") || "").trim() || null;
  const payment_method =
    String(formData.get("payment_method") || "").trim() || null;
  const reference = String(formData.get("reference") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const received_at = String(formData.get("received_at") || "").trim();

  if (!offering_type_id || Number.isNaN(amount) || amount < 0) {
    return { error: "Invalid type or amount" };
  }

  const { error } = await supabase.from("offerings").insert({
    org_id: profile.org_id,
    offering_type_id,
    amount,
    member_id,
    recorded_by: user.id,
    payment_method,
    reference,
    notes,
    received_at: received_at ? new Date(received_at).toISOString() : undefined,
  });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/offerings");
  return { ok: true };
}
