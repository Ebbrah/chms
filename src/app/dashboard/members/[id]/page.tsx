import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MemberEditForm } from "./member-edit-form";
import { getMyRoles } from "@/lib/auth/session";
import { canFinance } from "@/lib/auth/permissions";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, org_id")
    .eq("id", id)
    .single();
  if (!profile?.org_id) notFound();

  const orgId = String(profile.org_id);

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", id)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: households } = await supabase
    .from("households")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name");

  const { data: elderRoleRows } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "church_elder")
    .eq("org_id", orgId);
  const elderUserIds = Array.from(
    new Set((elderRoleRows ?? []).map((r) => String(r.user_id ?? "")).filter(Boolean)),
  );
  const { data: churchElderProfiles } = elderUserIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", elderUserIds).order("full_name")
    : { data: [] };

  const { data: householdsForChairs } = await supabase
    .from("households")
    .select("id, name, chairperson_user_id")
    .eq("org_id", orgId)
    .order("name");

  const { data: chairAssignRows } = await supabase
    .from("jumuiya_chair_assignments")
    .select("household_id, user_id")
    .eq("org_id", orgId);

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

  const { data: chairNameProfiles } = chairUserIds.size
    ? await supabase.from("profiles").select("id, full_name").in("id", Array.from(chairUserIds))
    : { data: [] };
  const chairNameById = new Map((chairNameProfiles ?? []).map((p) => [String(p.id), String(p.full_name ?? "")]));

  const roles = await getMyRoles();
  const allowEditDisplayName = canFinance(roles);

  const jumuiyaChairOptions = (householdsForChairs ?? [])
    .map((h) => {
      const fromHouse = String(h.chairperson_user_id ?? "").trim();
      const fromAssign = assignmentChairByHousehold.get(String(h.id)) ?? "";
      const userId = fromHouse || fromAssign;
      if (!userId) return null;
      return {
        householdId: String(h.id),
        userId,
        fullName: chairNameById.get(userId) ?? "—",
        jumuiyaLabel: String(h.name ?? ""),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Edit member</h1>
        <Button variant="outline" asChild>
          <Link href="/dashboard/members">Back</Link>
        </Button>
      </div>
      <MemberEditForm
        userId={profile.id}
        fullName={profile.full_name ?? ""}
        email={member?.email ?? profile.email ?? ""}
        member={member}
        households={households ?? []}
        churchElderOptions={churchElderProfiles ?? []}
        jumuiyaChairOptions={jumuiyaChairOptions}
        allowEditDisplayName={allowEditDisplayName}
      />
    </div>
  );
}
