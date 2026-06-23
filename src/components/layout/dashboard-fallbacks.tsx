"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function DashboardNavSkeleton({ horizontal }: { horizontal?: boolean }) {
  return (
    <nav className={`flex gap-1 p-2 ${horizontal ? "flex-row" : "flex-col"}`} aria-hidden>
      {Array.from({ length: horizontal ? 4 : 8 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded-md" />
      ))}
    </nav>
  );
}

export function DashboardHeaderFallback() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-8 w-24" />
    </header>
  );
}

export function BrandTitleFallback({ className }: { className?: string }) {
  return <Skeleton className={className ?? "h-6 w-32"} />;
}
