import { requireDistrictRegionalAccess } from "@/lib/auth/regional-guard";
import { RegionalRegistry } from "@/components/regional/regional-registry";

export default async function DistrictRegistryPage() {
  const { scope } = await requireDistrictRegionalAccess();
  return <RegionalRegistry scope={scope} />;
}
