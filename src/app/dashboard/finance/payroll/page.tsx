import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayrollSection } from "./payroll-section";

export default async function PayrollPage() {
  const supabase = await createClient();
  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .order("name");
  const { data: runs } = await supabase
    .from("payroll_runs")
    .select("*")
    .order("created_at", { ascending: false });
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code");
  const runIds = (runs ?? []).map((r) => r.id);
  const { data: lines } = runIds.length
    ? await supabase.from("payroll_lines").select("*").in("payroll_run_id", runIds)
    : { data: [] as Record<string, unknown>[] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
      </div>
      <PayrollSection
        employees={employees ?? []}
        runs={runs ?? []}
        accounts={accounts ?? []}
      />
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Run</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(lines ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No payroll lines.
                </TableCell>
              </TableRow>
            ) : (
              (lines ?? []).map((ln) => {
                const emp = (employees ?? []).find((e) => e.id === ln.employee_id);
                return (
                  <TableRow key={String(ln.id)}>
                    <TableCell>{String(emp?.name ?? ln.employee_id)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {String(ln.payroll_run_id).slice(0, 8)}…
                    </TableCell>
                    <TableCell className="text-right">{Number(ln.gross).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(ln.net).toFixed(2)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
