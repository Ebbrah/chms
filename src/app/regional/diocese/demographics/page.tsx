import { requireDioceseRegionalAccess } from "@/lib/auth/regional-guard";
import { RegionalDemographics } from "@/components/regional/regional-demographics";

export default async function DioceseDemographicsPage() {
  const { scope } = await requireDioceseRegionalAccess();
  return <RegionalDemographics scope={scope} />;
}
