import { requireDistrictRegionalAccess } from "@/lib/auth/regional-guard";
import { RegionalOverview } from "@/components/regional/regional-overview";

export default async function DistrictOverviewPage() {
  const { scope } = await requireDistrictRegionalAccess();
  return <RegionalOverview scope={scope} />;
}
