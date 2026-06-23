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

type DemoRow = {
  total_members: number;
  active_members: number;
  inactive_members: number;
  male_count: number;
  female_count: number;
  children_count: number;
  youth_count: number;
  adults_count: number;
  orphans_count: number;
  widows_count: number;
  unknown_gender: number;
};

type ParishRow = {
  org_id: string;
  parish_name: string;
  district_name?: string;
  total_members: number;
  active_members: number;
  male_count: number;
  female_count: number;
  children_count: number;
  youth_count: number;
  orphans_count: number;
  widows_count: number;
};

export async function RegionalDemographics({ scope }: { scope: RegionalScope }) {
  const supabase = await createClient();

  const summaryRpc =
    scope.type === "diocese" ? "report_diocese_demographics" : "report_district_demographics";
  const byParishRpc =
    scope.type === "diocese"
      ? "report_diocese_demographics_by_parish"
      : "report_district_demographics_by_parish";

  const [{ data: summaryRaw }, { data: parishRaw }] = await Promise.all([
    supabase.rpc(summaryRpc, { [`_${scope.type}_id`]: scope.id }),
    supabase.rpc(byParishRpc, { [`_${scope.type}_id`]: scope.id }),
  ]);

  const summary = (summaryRaw?.[0] ?? {}) as DemoRow;
  const parishes = (parishRaw ?? []) as ParishRow[];
  const scopeLabel = scope.type === "diocese" ? "Dayosisi" : "Jimbo";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Demographic roll-up</h1>
        <p className="text-sm text-muted-foreground">
          {scopeLabel}: {scope.name} — aggregate counts only.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total" value={summary.total_members} />
        <Stat label="Active" value={summary.active_members} />
        <Stat label="Inactive" value={summary.inactive_members} />
        <Stat label="Men" value={summary.male_count} />
        <Stat label="Women" value={summary.female_count} />
        <Stat label="Children" value={summary.children_count} />
        <Stat label="Youth" value={summary.youth_count} />
        <Stat label="Adults" value={summary.adults_count} />
        <Stat label="Orphans" value={summary.orphans_count} />
        <Stat label="Widows" value={summary.widows_count} />
        <Stat label="Unknown gender" value={summary.unknown_gender} />
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
                {scope.type === "diocese" ? <TableHead>Jimbo</TableHead> : null}
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Men</TableHead>
                <TableHead className="text-right">Women</TableHead>
                <TableHead className="text-right">Children</TableHead>
                <TableHead className="text-right">Youth</TableHead>
                <TableHead className="text-right">Orphans</TableHead>
                <TableHead className="text-right">Widows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parishes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={scope.type === "diocese" ? 10 : 9}
                    className="text-muted-foreground"
                  >
                    No parish data in this scope.
                  </TableCell>
                </TableRow>
              ) : (
                parishes.map((p) => (
                  <TableRow key={p.org_id}>
                    <TableCell className="font-medium">{p.parish_name}</TableCell>
                    {scope.type === "diocese" ? (
                      <TableCell className="text-muted-foreground">{p.district_name ?? "—"}</TableCell>
                    ) : null}
                    <TableCell className="text-right">{p.total_members}</TableCell>
                    <TableCell className="text-right">{p.active_members}</TableCell>
                    <TableCell className="text-right">{p.male_count}</TableCell>
                    <TableCell className="text-right">{p.female_count}</TableCell>
                    <TableCell className="text-right">{p.children_count}</TableCell>
                    <TableCell className="text-right">{p.youth_count}</TableCell>
                    <TableCell className="text-right">{p.orphans_count}</TableCell>
                    <TableCell className="text-right">{p.widows_count}</TableCell>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-semibold">{value ?? 0}</p>
      </CardContent>
    </Card>
  );
}
