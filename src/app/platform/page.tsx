import { createClient } from "@/lib/supabase/server";
import { requirePlatformAccess } from "@/lib/auth/platform-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OperatorContextSwitcher } from "./operator-context-switcher";

type RollupRow = {
  parish_count: number;
  active_parish_count: number;
  suspended_parish_count: number;
  total_members: number;
  active_members: number;
  total_offerings_amount: number;
};

type DistrictRow = {
  district_id: string;
  district_name: string;
  diocese_name: string;
  parish_count: number;
  member_count: number;
};

export default async function PlatformOverviewPage() {
  const { isAdmin } = await requirePlatformAccess();
  const supabase = await createClient();

  const { data: parishes } = await supabase
    .from("organizations")
    .select("id, display_name, slug, status")
    .order("display_name");

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform</h1>
          <p className="text-sm text-muted-foreground">
            Switch parish context for parishes you operate.
          </p>
        </div>
        <OperatorContextSwitcher parishes={parishes ?? []} />
      </div>
    );
  }

  const [{ data: rollups }, { data: byDistrict }] = await Promise.all([
    supabase.rpc("report_platform_rollups").maybeSingle(),
    supabase.rpc("report_parish_counts_by_district"),
  ]);

  const stats = (rollups ?? {}) as RollupRow;
  const districts = (byDistrict ?? []) as DistrictRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
          <p className="text-sm text-muted-foreground">
            Totals only — no cross-parish member detail.
          </p>
        </div>
        <OperatorContextSwitcher parishes={parishes ?? []} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Parishes" value={String(stats.parish_count ?? 0)} />
        <StatCard label="Active parishes" value={String(stats.active_parish_count ?? 0)} />
        <StatCard label="Suspended" value={String(stats.suspended_parish_count ?? 0)} />
        <StatCard label="Total members" value={String(stats.total_members ?? 0)} />
        <StatCard label="Active members" value={String(stats.active_members ?? 0)} />
        <StatCard
          label="Authorized offerings (all parishes)"
          value={formatCurrency(stats.total_offerings_amount ?? 0)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Parishes by jimbo</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dayosisi</TableHead>
                <TableHead>Jimbo</TableHead>
                <TableHead className="text-right">Parishes</TableHead>
                <TableHead className="text-right">Members</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {districts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No jimbo data yet.
                  </TableCell>
                </TableRow>
              ) : (
                districts.map((row) => (
                  <TableRow key={row.district_id}>
                    <TableCell>{row.diocese_name}</TableCell>
                    <TableCell>{row.district_name}</TableCell>
                    <TableCell className="text-right">{row.parish_count}</TableCell>
                    <TableCell className="text-right">{row.member_count}</TableCell>
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
