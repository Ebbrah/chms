import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, isPlatformAdmin } from "@/lib/auth/session";

export type { DioceseOfficerRole, DistrictOfficerRole } from "@/lib/auth/regional-roles";
export { DIOCESE_ROLE_LABELS, DISTRICT_ROLE_LABELS } from "@/lib/auth/regional-roles";

export type RegionalScope = {
  type: "diocese" | "district";
  id: string;
  name: string;
  roles: string[];
  canFinance: boolean;
};

const getDioceseOfficerScope = cache(async (): Promise<RegionalScope | null> => {
  try {
    const supabase = await createClient();
    const user = await getSessionUser();
    if (!user) return null;

    const { data: dioceseOfficer, error } = await supabase
      .from("diocese_officers")
      .select("role, dioceses ( id, name )")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (error || !dioceseOfficer?.dioceses) return null;

  const dioceseRaw = dioceseOfficer.dioceses;
  const diocese = (Array.isArray(dioceseRaw) ? dioceseRaw[0] : dioceseRaw) as {
    id: string;
    name: string;
  };
  const { data: allRoles } = await supabase
    .from("diocese_officers")
    .select("role")
    .eq("user_id", user.id)
    .eq("diocese_id", diocese.id);
  const roles = (allRoles ?? []).map((r) => r.role as string);

  return {
    type: "diocese",
    id: diocese.id,
    name: diocese.name,
    roles,
    canFinance: roles.includes("diocese_treasurer"),
  };
  } catch {
    return null;
  }
});

const getDistrictOfficerScope = cache(async (): Promise<RegionalScope | null> => {
  try {
    const supabase = await createClient();
    const user = await getSessionUser();
    if (!user) return null;

    const { data: districtOfficer, error } = await supabase
      .from("district_officers")
      .select("role, districts ( id, name )")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (error || !districtOfficer?.districts) return null;

  const districtRaw = districtOfficer.districts;
  const district = (Array.isArray(districtRaw) ? districtRaw[0] : districtRaw) as {
    id: string;
    name: string;
  };
  const { data: allRoles } = await supabase
    .from("district_officers")
    .select("role")
    .eq("user_id", user.id)
    .eq("district_id", district.id);
  const roles = (allRoles ?? []).map((r) => r.role as string);

  return {
    type: "district",
    id: district.id,
    name: district.name,
    roles,
    canFinance: roles.includes("district_treasurer"),
  };
  } catch {
    return null;
  }
});

async function getPlatformAdminDioceseScope(): Promise<RegionalScope | null> {
  if (!(await isPlatformAdmin())) return null;

  const supabase = await createClient();
  const { data: diocese } = await supabase
    .from("dioceses")
    .select("id, name")
    .order("name")
    .limit(1)
    .maybeSingle();

  if (!diocese) return null;

  return {
    type: "diocese",
    id: diocese.id,
    name: diocese.name,
    roles: ["platform_admin"],
    canFinance: true,
  };
}

async function getPlatformAdminDistrictScope(): Promise<RegionalScope | null> {
  if (!(await isPlatformAdmin())) return null;

  const supabase = await createClient();
  const { data: district } = await supabase
    .from("districts")
    .select("id, name")
    .order("name")
    .limit(1)
    .maybeSingle();

  if (!district) return null;

  return {
    type: "district",
    id: district.id,
    name: district.name,
    roles: ["platform_admin"],
    canFinance: true,
  };
}

/** Primary scope for nav visibility — diocese officers take precedence over district. */
export const getRegionalScope = cache(async (): Promise<RegionalScope | null> => {
  return (
    (await getDioceseOfficerScope()) ??
    (await getDistrictOfficerScope()) ??
    (await getPlatformAdminDioceseScope())
  );
});

export async function getRegionalEntryPath(): Promise<string> {
  const dioceseScope = await getDioceseOfficerScope();
  if (dioceseScope) return "/regional/diocese";

  const districtScope = await getDistrictOfficerScope();
  if (districtScope) return "/regional/district";

  if (await isPlatformAdmin()) return "/regional/diocese";

  return "/dashboard";
}

export async function requireDioceseRegionalAccess() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const scope =
    (await getDioceseOfficerScope()) ?? (await getPlatformAdminDioceseScope());
  if (!scope) {
    if (await getDistrictOfficerScope()) redirect("/regional/district");
    redirect("/dashboard");
  }

  return { user, scope };
}

export async function requireDistrictRegionalAccess() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const scope =
    (await getDistrictOfficerScope()) ?? (await getPlatformAdminDistrictScope());
  if (!scope) {
    if (await getDioceseOfficerScope()) redirect("/regional/diocese");
    redirect("/dashboard");
  }

  return { user, scope };
}

export async function canAccessRegional(): Promise<boolean> {
  const scope = await getRegionalScope();
  return scope !== null;
}
