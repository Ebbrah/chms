import { DashboardNav } from "@/components/layout/dashboard-nav";
import { getMyRoles } from "@/lib/auth/session";

export async function DashboardNavLoader({ horizontal }: { horizontal?: boolean }) {
  const roles = await getMyRoles();
  return <DashboardNav roles={roles} horizontal={horizontal} />;
}
