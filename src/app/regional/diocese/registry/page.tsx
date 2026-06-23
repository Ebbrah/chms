import { requireDioceseRegionalAccess } from "@/lib/auth/regional-guard";
import { RegionalRegistry } from "@/components/regional/regional-registry";

export default async function DioceseRegistryPage() {
  const { scope } = await requireDioceseRegionalAccess();
  return <RegionalRegistry scope={scope} />;
}
