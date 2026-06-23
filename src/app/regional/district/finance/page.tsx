import { redirect } from "next/navigation";
import { requireDistrictRegionalAccess } from "@/lib/auth/regional-guard";
import { RegionalFinance } from "@/components/regional/regional-finance";

export default async function DistrictFinancePage() {
  const { scope } = await requireDistrictRegionalAccess();
  if (!scope.canFinance) redirect("/regional/district");
  return <RegionalFinance scope={scope} />;
}
