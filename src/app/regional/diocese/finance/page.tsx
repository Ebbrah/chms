import { redirect } from "next/navigation";
import { requireDioceseRegionalAccess } from "@/lib/auth/regional-guard";
import { RegionalFinance } from "@/components/regional/regional-finance";

export default async function DioceseFinancePage() {
  const { scope } = await requireDioceseRegionalAccess();
  if (!scope.canFinance) redirect("/regional/diocese");
  return <RegionalFinance scope={scope} />;
}
