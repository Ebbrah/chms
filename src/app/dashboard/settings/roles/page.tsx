import { createClient } from "@/lib/supabase/server";
import { RolesSection } from "./roles-section";
import { RolesUserTable } from "./roles-user-table";

export default async function RolesSettingsPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .order("full_name");
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("user_id, role");
  const { data: committees } = await supabase
    .from("committees")
    .select("id, name")
    .order("name");
  const { data: households } = await supabase
    .from("households")
    .select("id, name")
    .order("name");

  const rolesByUser = new Map<string, string[]>();
  for (const ur of userRoles ?? []) {
    const uid = ur.user_id as string;
    if (!rolesByUser.has(uid)) rolesByUser.set(uid, []);
    rolesByUser.get(uid)!.push(ur.role as string);
  }
  const committeeHeadIds = new Set(
    (userRoles ?? [])
      .filter((ur) => ur.role === "committee_head")
      .map((ur) => String(ur.user_id)),
  );
  const jumuiyaChairmanIds = new Set(
    (userRoles ?? [])
      .filter((ur) => ur.role === "jumuiya_chairman")
      .map((ur) => String(ur.user_id)),
  );
  const churchElderIds = new Set(
    (userRoles ?? [])
      .filter((ur) => ur.role === "church_elder")
      .map((ur) => String(ur.user_id)),
  );

  const committeeHeadProfiles = (profiles ?? []).filter((p) => committeeHeadIds.has(String(p.id)));
  const jumuiyaChairmanProfiles = (profiles ?? []).filter((p) => jumuiyaChairmanIds.has(String(p.id)));
  const churchElderProfiles = (profiles ?? []).filter((p) => churchElderIds.has(String(p.id)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">User roles</h1>
      </div>
      <RolesSection
        profiles={profiles ?? []}
        committees={committees ?? []}
        households={households ?? []}
        committeeHeadProfiles={committeeHeadProfiles}
        jumuiyaChairmanProfiles={jumuiyaChairmanProfiles}
        churchElderProfiles={churchElderProfiles}
      />
      <RolesUserTable
        rows={(profiles ?? []).map((p) => ({
          id: p.id,
          full_name: p.full_name,
          phone: p.phone,
          roles: (rolesByUser.get(p.id) ?? []).join(", "),
        }))}
      />
    </div>
  );
}
