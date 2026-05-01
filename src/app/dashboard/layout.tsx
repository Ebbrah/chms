import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/layout/dashboard-nav";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { getMyRoles, getSessionUser } from "@/lib/auth/session";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const roles = await getMyRoles();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 border-r border-border md:block">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
            ChMS
          </Link>
        </div>
        <ScrollArea className="h-[calc(100vh-3.5rem)]">
          <DashboardNav roles={roles} />
        </ScrollArea>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-2 py-2 md:hidden">
          <Link href="/dashboard" className="px-2 font-semibold">
            ChMS
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <ScrollArea className="flex-1 whitespace-nowrap">
            <DashboardNav roles={roles} horizontal />
          </ScrollArea>
        </div>
        <DashboardHeader />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
