import type { SupabaseClient } from "@supabase/supabase-js";

export type LeaderProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

/** Wazee wa kanisa assigned to this jumuiya (`jumuiya_elder_assignments`). */
export async function loadEldersForHousehold(
  supabase: SupabaseClient,
  householdId: string | null | undefined,
): Promise<LeaderProfile[]> {
  if (!householdId) return [];
  const { data: assignments } = await supabase
    .from("jumuiya_elder_assignments")
    .select("user_id")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true })
    .limit(2);
  const elderIds = Array.from(
    new Set((assignments ?? []).map((row) => String(row.user_id ?? "")).filter(Boolean)),
  );
  if (elderIds.length === 0) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", elderIds);
  const profileMap = new Map((profiles ?? []).map((p) => [String(p.id), p]));
  return elderIds.map((id) => profileMap.get(id)).filter((row): row is LeaderProfile => Boolean(row));
}

/** Mwenyekiti wa jumuiya from `households.chairperson_user_id`. */
export async function loadChairProfileForHousehold(
  supabase: SupabaseClient,
  householdId: string | null | undefined,
): Promise<LeaderProfile | null> {
  if (!householdId) return null;
  const { data: h } = await supabase
    .from("households")
    .select("chairperson_user_id")
    .eq("id", householdId)
    .maybeSingle();
  const uid = h?.chairperson_user_id;
  if (!uid) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .eq("id", uid)
    .maybeSingle();
  return p ?? null;
}
