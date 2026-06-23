import Link from "next/link";
import { requirePlatformAccess } from "@/lib/auth/platform-guard";
import { PlatformNav } from "@/components/layout/platform-nav";

export async function PlatformShell({ children }: { children: React.ReactNode }) {
  await requirePlatformAccess();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 border-r border-border md:block">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/platform" className="text-lg font-semibold tracking-tight">
            <span className="text-primary">ChMS</span>{" "}
            <span className="text-foreground">Platform</span>
          </Link>
        </div>
        <PlatformNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 md:hidden">
          <Link href="/platform" className="font-semibold">
            ChMS Platform
          </Link>
        </div>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
