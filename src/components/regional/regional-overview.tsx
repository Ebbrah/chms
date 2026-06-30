import { createClient } from "@/lib/supabase/server";
import type { RegionalScope } from "@/lib/auth/regional-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DemoRow = {
  total_members: number;
  active_members: number;
  inactive_members: number;
  male_count: number;
  female_count: number;
  children_count: number;
  youth_count: number;
  orphans_count: number;
  widows_count: number;
};

export async function RegionalOverview({ scope }: { scope: RegionalScope }) {
  const supabase = await createClient();

  const rpcName =
    scope.type === "diocese" ? "report_diocese_demographics" : "report_district_demographics";
  const { data: demoRaw } = await supabase.rpc(rpcName, {
    [`_${scope.type}_id`]: scope.id,
  });

  const demo = (demoRaw?.[0] ?? {}) as DemoRow;

  let financeTotal = 0;
  if (scope.canFinance) {
    const financeRpc =
      scope.type === "diocese"
        ? "report_diocese_financial_totals"
        : "report_district_financial_totals";
    const { data: finRaw } = await supabase.rpc(financeRpc, {
      [`_${scope.type}_id`]: scope.id,
    });
    financeTotal = Number(finRaw?.[0]?.total_offerings ?? 0);
  }

  const scopeLabel = scope.type === "diocese" ? "Dayosisi" : "Jimbo";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{scopeLabel} overview</h1>
        <p className="text-sm text-muted-foreground">
          {scope.name} — totals only, no cross-parish member detail.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total members" value={String(demo.total_members ?? 0)} />
        <StatCard label="Active members" value={String(demo.active_members ?? 0)} />
        <StatCard label="Children" value={String(demo.children_count ?? 0)} />
        <StatCard label="Youth" value={String(demo.youth_count ?? 0)} />
      </div>

      {scope.canFinance ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Offering totals (approved batches)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(financeTotal)}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(amount);
}
