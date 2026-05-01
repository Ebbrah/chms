"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function orgForCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, orgId: null as string | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  return { supabase, orgId: profile?.org_id ?? null };
}

export async function assignCommitteeHead(formData: FormData) {
  const { supabase, orgId } = await orgForCurrentUser();
  if (!orgId) return { error: "Unauthorized" };

  const userId = String(formData.get("user_id") || "");
  const committeeId = String(formData.get("committee_id") || "");
  if (!userId || !committeeId) return { error: "User and committee are required" };

  await supabase.from("committee_heads").delete().eq("org_id", orgId).eq("committee_id", committeeId);
  const { error } = await supabase.from("committee_heads").insert({
    org_id: orgId,
    user_id: userId,
    committee_id: committeeId,
  });
  if (error) {
    if (error.code === "23505") return { error: "This user is already assigned there" };
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings/roles");
  return { ok: true };
}

export async function assignJumuiyaChairman(formData: FormData) {
  const { supabase, orgId } = await orgForCurrentUser();
  if (!orgId) return { error: "Unauthorized" };

  const userId = String(formData.get("user_id") || "");
  const householdId = String(formData.get("household_id") || "");
  if (!userId || !householdId) return { error: "User and jumuiya are required" };

  await supabase.from("jumuiya_chair_assignments").delete().eq("org_id", orgId).eq("household_id", householdId);
  const { error } = await supabase.from("jumuiya_chair_assignments").insert({
    org_id: orgId,
    user_id: userId,
    household_id: householdId,
  });
  if (error) {
    if (error.code === "23505") return { error: "This user is already assigned there" };
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings/roles");
  return { ok: true };
}

export async function assignChurchElderToJumuiya(formData: FormData) {
  const { supabase, orgId } = await orgForCurrentUser();
  if (!orgId) return { error: "Unauthorized" };

  const userId = String(formData.get("user_id") || "");
  const householdId = String(formData.get("household_id") || "");
  if (!userId || !householdId) return { error: "Mzee wa kanisa and jumuiya are required" };

  await supabase.from("jumuiya_elder_assignments").delete().eq("org_id", orgId).eq("household_id", householdId);
  const { error } = await supabase.from("jumuiya_elder_assignments").insert({
    org_id: orgId,
    user_id: userId,
    household_id: householdId,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings/roles");
  return { ok: true };
}
