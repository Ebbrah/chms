import Link from "next/link";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { canAccessPlatform } from "@/lib/auth/platform-guard";
import { canAccessRegional } from "@/lib/auth/regional-guard";
import { getMyRoles, getProfile, getSessionUser } from "@/lib/auth/session";
import { getCurrentParishBranding } from "@/lib/platform/parish-branding";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Load all layout data in one server pass and pass only serializable props to client UI.
  const user = await getSessionUser();
  const [roles, parish, profile] = await Promise.all([
    getMyRoles(),
    getCurrentParishBranding(),
    user ? getProfile() : Promise.resolve(null),
  ]);

  const fullName = String(profile?.full_name ?? "").trim();
  const fallbackName = String(user?.user_metadata?.full_name ?? "").trim();
  const displayName = fullName || fallbackName || "Member";
  const brandLabel = parish?.displayName ?? "Ebenezer";

  let showPlatform = false;
  let showRegional = false;
  if (user) {
    try {
      [showPlatform, showRegional] = await Promise.all([
        canAccessPlatform(),
        canAccessRegional(),
      ]);
    } catch {
      /* MT tables may lag behind app deploy — parish dashboard must still load. */
    }
  }

  const brandTitle = (
    <>
      <span className="text-primary">{brandLabel}</span>{" "}
      <span className="text-foreground">ChMS</span>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 border-r border-border md:block">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            {brandTitle}
          </Link>
        </div>
        <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
          <DashboardNav roles={roles} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-2 py-2 md:hidden">
          <Link href="/dashboard" className="px-2 font-semibold">
            {brandTitle}
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
            <DashboardNav roles={roles} horizontal />
          </div>
        </div>
        <DashboardHeader
          displayName={displayName}
          showPlatform={showPlatform}
          showRegional={showRegional}
          parish={parish}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
