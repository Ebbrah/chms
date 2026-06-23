import Link from "next/link";
import { Suspense } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import {
  BrandTitleFallback,
  DashboardHeaderFallback,
} from "@/components/layout/dashboard-fallbacks";
import { getCurrentParishBranding } from "@/lib/platform/parish-branding";
import { getMyRoles } from "@/lib/auth/session";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

async function BrandTitle() {
  const parish = await getCurrentParishBranding();
  const brandLabel = parish?.displayName ?? "Ebenezer";
  return (
    <>
      <span className="text-primary">{brandLabel}</span>{" "}
      <span className="text-foreground">ChMS</span>
    </>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Load roles in the layout (server) and pass serializable data to the client nav.
  // Avoid wrapping async server components inside client UI primitives (ScrollArea).
  const roles = await getMyRoles();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 border-r border-border md:block">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            <Suspense fallback={<BrandTitleFallback />}>
              <BrandTitle />
            </Suspense>
          </Link>
        </div>
        <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
          <DashboardNav roles={roles} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-2 py-2 md:hidden">
          <Link href="/dashboard" className="px-2 font-semibold">
            <Suspense fallback={<BrandTitleFallback className="h-5 w-28" />}>
              <BrandTitle />
            </Suspense>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">
            <DashboardNav roles={roles} horizontal />
          </div>
        </div>
        <Suspense fallback={<DashboardHeaderFallback />}>
          <DashboardHeader />
        </Suspense>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
