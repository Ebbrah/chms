import { createClient } from "@/lib/supabase/server";
import { requirePlatformAdmin } from "@/lib/auth/platform-guard";
import { OfficersManagement } from "@/app/platform/officers/officers-management";
import type { DioceseOfficerRole, DistrictOfficerRole } from "@/lib/auth/regional-roles";

export default async function PlatformOfficersPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();

  const [
    { data: dioceses },
    { data: districts },
    { data: dioceseOfficersRaw },
    { data: districtOfficersRaw },
  ] = await Promise.all([
    supabase.from("dioceses").select("id, name").order("name"),
    supabase.from("districts").select("id, name, diocese_id").order("name"),
    supabase
      .from("diocese_officers")
      .select("id, role, user_id, dioceses ( name )")
      .order("created_at", { ascending: false }),
    supabase
      .from("district_officers")
      .select("id, role, user_id, districts ( name )")
      .order("created_at", { ascending: false }),
  ]);

  const userIds = [
    ...(dioceseOfficersRaw ?? []).map((o) => o.user_id as string),
    ...(districtOfficersRaw ?? []).map((o) => o.user_id as string),
  ];
  const uniqueUserIds = [...new Set(userIds)];

  const { data: profiles } = uniqueUserIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", uniqueUserIds)
    : { data: [] };

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const dioceseOfficers = (dioceseOfficersRaw ?? []).map((o) => {
    const diocese = Array.isArray(o.dioceses) ? o.dioceses[0] : o.dioceses;
    return {
      id: o.id as string,
      role: o.role as DioceseOfficerRole,
      dioceses: (diocese as { name: string } | null) ?? null,
      profiles: profileById.get(o.user_id as string) ?? null,
    };
  });

  const districtOfficers = (districtOfficersRaw ?? []).map((o) => {
    const district = Array.isArray(o.districts) ? o.districts[0] : o.districts;
    return {
      id: o.id as string,
      role: o.role as DistrictOfficerRole,
      districts: (district as { name: string } | null) ?? null,
      profiles: profileById.get(o.user_id as string) ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Regional officers</h1>
        <p className="text-sm text-muted-foreground">
          Assign dayosisi and jimbo officers. Users must already have an account.
        </p>
      </div>
      <OfficersManagement
        dioceses={dioceses ?? []}
        districts={districts ?? []}
        dioceseOfficers={dioceseOfficers}
        districtOfficers={districtOfficers}
      />
    </div>
  );
}
