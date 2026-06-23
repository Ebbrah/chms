import { requireDistrictRegionalAccess } from "@/lib/auth/regional-guard";
import { RegionalShell } from "@/components/regional/regional-shell";

export const dynamic = "force-dynamic";

export default async function DistrictRegionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { scope } = await requireDistrictRegionalAccess();
  return <RegionalShell scope={scope}>{children}</RegionalShell>;
}
