import { requireDioceseRegionalAccess } from "@/lib/auth/regional-guard";
import { RegionalShell } from "@/components/regional/regional-shell";

export const dynamic = "force-dynamic";

export default async function DioceseRegionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { scope } = await requireDioceseRegionalAccess();
  return <RegionalShell scope={scope}>{children}</RegionalShell>;
}
