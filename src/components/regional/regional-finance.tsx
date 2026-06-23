import { createClient } from "@/lib/supabase/server";
import type { RegionalScope } from "@/lib/auth/regional-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function RegionalFinance({ scope }: { scope: RegionalScope }) {
  const supabase = await createClient();
  const totalsRpc =
    scope.type === "diocese" ? "report_diocese_financial_totals" : "report_district_financial_totals";
  const byParishRpc = "report_district_financial_by_parish";

  const { data: totalsRaw } = await supabase.rpc(totalsRpc, {
    [`_${scope.type}_id`]: scope.id,
  });

  const totals = totalsRaw?.[0] as { total_offerings: number; parish_count: number } | undefined;

  let parishRows: { org_id: string; parish_name: string; total_offerings: number }[] = [];
  if (scope.type === "district") {
    const { data } = await supabase.rpc(byParishRpc, { _district_id: scope.id });
    parishRows = (data ?? []) as typeof parishRows;
  } else {
    const { data: districts } = await supabase
      .from("districts")
      .select("id, name")
      .eq("diocese_id", scope.id);
    for (const district of districts ?? []) {
      const { data } = await supabase.rpc(byParishRpc, { _district_id: district.id });
      for (const row of (data ?? []) as typeof parishRows) {
        parishRows.push(row);
      }
    }
    parishRows.sort((a, b) => a.parish_name.localeCompare(b.parish_name));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Financial totals</h1>
        <p className="text-sm text-muted-foreground">
          Offering totals only — no parish ledger detail.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total offerings (all time)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(Number(totals?.total_offerings ?? 0))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Parishes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totals?.parish_count ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">By parish</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parish</TableHead>
                <TableHead className="text-right">Offerings total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parishRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">
                    No offering data in this scope.
                  </TableCell>
                </TableRow>
              ) : (
                parishRows.map((row) => (
                  <TableRow key={row.org_id}>
                    <TableCell className="font-medium">{row.parish_name}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(row.total_offerings))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-TZ", {
    style: "currency",
    currency: "TZS",
    maximumFractionDigits: 0,
  }).format(amount);
}
