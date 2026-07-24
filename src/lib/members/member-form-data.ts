import { createClient } from "@/lib/supabase/server";

/** Shared household / leader options for member edit forms (admin, self-service, onboarding). */
export async function loadMemberEditFormData(orgId: string) {
  const supabase = await createClient();

  const [
    { data: householdsForChairs },
    { data: elderRoleRows },
    { data: chairAssignRows },
  ] = await Promise.all([
    supabase
      .from("households")
      .select("id, name, chairperson_user_id")
      .eq("org_id", orgId)
      .order("name"),
    supabase.from("user_roles").select("user_id").eq("role", "church_elder").eq("org_id", orgId),
    supabase.from("jumuiya_chair_assignments").select("household_id, user_id").eq("org_id", orgId),
  ]);

  const elderUserIds = Array.from(
    new Set((elderRoleRows ?? []).map((r) => String(r.user_id ?? "")).filter(Boolean)),
  );

  const assignmentChairByHousehold = new Map<string, string>();
  for (const row of chairAssignRows ?? []) {
    const hid = String(row.household_id ?? "");
    if (!hid || assignmentChairByHousehold.has(hid)) continue;
    assignmentChairByHousehold.set(hid, String(row.user_id ?? ""));
  }

  const chairUserIds = new Set<string>();
  for (const h of householdsForChairs ?? []) {
    const fromHouse = String(h.chairperson_user_id ?? "").trim();
    const fromAssign = assignmentChairByHousehold.get(String(h.id)) ?? "";
    const uid = fromHouse || fromAssign;
    if (uid) chairUserIds.add(uid);
  }

  const profileIds = Array.from(new Set([...elderUserIds, ...chairUserIds]));
  const { data: profileRows } = profileIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
    : { data: [] };

  const profileById = new Map(
    (profileRows ?? []).map((p) => [String(p.id), String(p.full_name ?? "")]),
  );

  const churchElderProfiles = elderUserIds
    .map((id) => ({ id, full_name: profileById.get(id) ?? "—" }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const jumuiyaChairOptions = (householdsForChairs ?? [])
    .map((h) => {
      const fromHouse = String(h.chairperson_user_id ?? "").trim();
      const fromAssign = assignmentChairByHousehold.get(String(h.id)) ?? "";
      const userId = fromHouse || fromAssign;
      if (!userId) return null;
      return {
        householdId: String(h.id),
        userId,
        fullName: profileById.get(userId) ?? "—",
        jumuiyaLabel: String(h.name ?? ""),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  return {
    households: (householdsForChairs ?? []).map(({ id, name }) => ({ id, name })),
    churchElderOptions: churchElderProfiles,
    jumuiyaChairOptions,
  };
}
