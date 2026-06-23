import { requireDioceseRegionalAccess } from "@/lib/auth/regional-guard";
import { RegionalOverview } from "@/components/regional/regional-overview";

export default async function DioceseOverviewPage() {
  const { scope } = await requireDioceseRegionalAccess();
  return <RegionalOverview scope={scope} />;
}
