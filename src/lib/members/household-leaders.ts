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

  // Some users have phone filled on their member profile but blank on auth profile.
  // Fallback to members.phone so dashboards still show reachable elder contacts.
  const { data: memberPhones } = await supabase
    .from("members")
    .select("user_id, phone, updated_at")
    .eq("household_id", householdId)
    .in("user_id", elderIds)
    .order("updated_at", { ascending: false });
  const memberPhoneByUserId = new Map<string, string>();
  for (const row of memberPhones ?? []) {
    const uid = String(row.user_id ?? "");
    const phone = String(row.phone ?? "").trim();
    if (!uid || !phone || memberPhoneByUserId.has(uid)) continue;
    memberPhoneByUserId.set(uid, phone);
  }

  const elders: LeaderProfile[] = [];
  for (const id of elderIds) {
    const profile = profileMap.get(id);
    if (!profile) continue;
    const profilePhone = String(profile.phone ?? "").trim();
    const fallbackPhone = memberPhoneByUserId.get(id) ?? null;
    elders.push({
      id: String(profile.id),
      full_name: profile.full_name ?? null,
      phone: profilePhone || fallbackPhone,
    });
  }
  return elders;
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
  let uid = String(h?.chairperson_user_id ?? "").trim();
  if (!uid) {
    const { data: assignment } = await supabase
      .from("jumuiya_chair_assignments")
      .select("user_id")
      .eq("household_id", householdId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    uid = String(assignment?.user_id ?? "").trim();
  }
  if (!uid) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .eq("id", uid)
    .maybeSingle();
  if (!p) return null;

  const profilePhone = String(p.phone ?? "").trim();
  if (profilePhone) return p;

  const { data: chairMember } = await supabase
    .from("members")
    .select("phone, updated_at")
    .eq("household_id", householdId)
    .eq("user_id", uid)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    id: String(p.id),
    full_name: p.full_name ?? null,
    phone: String(chairMember?.phone ?? "").trim() || null,
  };
}
