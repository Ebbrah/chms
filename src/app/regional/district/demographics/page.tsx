import { requireDistrictRegionalAccess } from "@/lib/auth/regional-guard";
import { RegionalDemographics } from "@/components/regional/regional-demographics";

export default async function DistrictDemographicsPage() {
  const { scope } = await requireDistrictRegionalAccess();
  return <RegionalDemographics scope={scope} />;
}
