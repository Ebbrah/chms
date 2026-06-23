import Link from "next/link";
import { Suspense } from "react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DashboardNavLoader } from "@/components/layout/dashboard-nav-loader";
import {
  BrandTitleFallback,
  DashboardHeaderFallback,
  DashboardNavSkeleton,
} from "@/components/layout/dashboard-fallbacks";
import { getCurrentParishBranding } from "@/lib/platform/parish-branding";
import { ScrollArea } from "@/components/ui/scroll-area";
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
        <Suspense fallback={<DashboardNavSkeleton />}>
          <ScrollArea className="h-[calc(100vh-3.5rem)]">
            <DashboardNavLoader />
          </ScrollArea>
        </Suspense>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-2 py-2 md:hidden">
          <Link href="/dashboard" className="px-2 font-semibold">
            <Suspense fallback={<BrandTitleFallback className="h-5 w-28" />}>
              <BrandTitle />
            </Suspense>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <Suspense fallback={<DashboardNavSkeleton horizontal />}>
            <ScrollArea className="flex-1 whitespace-nowrap">
              <DashboardNavLoader horizontal />
            </ScrollArea>
          </Suspense>
        </div>
        <Suspense fallback={<DashboardHeaderFallback />}>
          <DashboardHeader />
        </Suspense>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
