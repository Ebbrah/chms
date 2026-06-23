import Link from "next/link";
import type { RegionalScope } from "@/lib/auth/regional-guard";
import { RegionalNav } from "@/components/layout/regional-nav";

export function RegionalShell({
  scope,
  children,
}: {
  scope: RegionalScope;
  children: React.ReactNode;
}) {
  const basePath = scope.type === "diocese" ? "/regional/diocese" : "/regional/district";
  const scopeLabel = scope.type === "diocese" ? "Dayosisi" : "Jimbo";
  const brandLabel = scope.type === "diocese" ? "Dayosisi" : "Jimbo";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="hidden w-56 shrink-0 border-r border-border md:block">
          <div className="flex h-14 flex-col justify-center border-b border-border px-4">
            <Link href={basePath} className="text-lg font-semibold tracking-tight">
              <span className="text-primary">ChMS</span>{" "}
              <span className="text-foreground">{brandLabel}</span>
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {scopeLabel}: {scope.name}
            </p>
          </div>
          <RegionalNav basePath={basePath} showFinance={scope.canFinance} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border px-4 py-3 md:hidden">
            <p className="font-semibold">ChMS {brandLabel}</p>
            <p className="text-xs text-muted-foreground">
              {scopeLabel}: {scope.name}
            </p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              <RegionalNav basePath={basePath} showFinance={scope.canFinance} horizontal />
            </div>
          </div>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
  );
}
