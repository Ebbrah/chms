import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { getMyRoles, getSessionUser } from "@/lib/auth/session";
import { getCurrentParishBranding } from "@/lib/platform/parish-branding";
import type { AppRole } from "@/lib/auth/roles";
import { Separator } from "@/components/ui/separator";

/** Auth-gated — must not statically prerender (no session at build time). */
export const dynamic = "force-dynamic";

/** Plain JSON roles only — never pass cached/query objects into client nav. */
function toSerializableRoles(roles: AppRole[]): AppRole[] {
  return roles.map((role) => String(role) as AppRole);
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let roles: AppRole[] = [];
  let brandLabel = "Ebenezer";

  try {
    roles = toSerializableRoles(await getMyRoles());
  } catch {
    /* Keep sidebar usable if role query fails. */
  }

  try {
    const parish = await getCurrentParishBranding();
    if (parish?.displayName) brandLabel = parish.displayName;
  } catch {
    /* Default label is fine. */
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 border-r border-border md:block">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            <span className="text-primary">{brandLabel}</span>{" "}
            <span className="text-foreground">ChMS</span>
          </Link>
        </div>
        <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
          <DashboardNav roles={roles} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-2 py-2 md:hidden">
          <Link href="/dashboard" className="px-2 font-semibold">
            <span className="text-primary">{brandLabel}</span>{" "}
            <span className="text-foreground">ChMS</span>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
            <DashboardNav roles={roles} horizontal />
          </div>
        </div>
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
