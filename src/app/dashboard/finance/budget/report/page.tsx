import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type LineRow, one, rowPlanningContext, timeframeLabel } from "../budget-line-model";

export default async function FullBudgetReportPage() {
  const supabase = await createClient();
  const { data: lines, error } = await supabase
    .from("budget_lines")
    .select(
      [
        "id, budget_id, account_id, target_id, amount, indicators, results, timeframe_start, timeframe_end, mhusika",
        "budgets(name,status)",
        "accounts(code, name)",
        "planning_targets(name, indicator, expected_result, planning_goals(name, planning_priorities(name)))",
      ].join(", "),
    )
    .order("id", { ascending: false })
    .limit(500);

  const rows = (lines ?? []) as unknown as LineRow[];
  const numberFormatter = new Intl.NumberFormat("en-US");
  const total = rows.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Full budget report</h1>
          <p className="text-sm text-muted-foreground">
            Kipaumbele, Lengo, Shabaha, Shughuli, Account, Amount, Kiashiria, Matokeo, time frame, Mhusika
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/finance/budget">Back to budgets</Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error.message}
        </div>
      ) : null}

      <div className="rounded-md border border-border">
        <div className="max-h-[calc(100vh-12rem)] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">Kipaumbele</TableHead>
                <TableHead className="min-w-[120px]">Lengo</TableHead>
                <TableHead className="min-w-[120px]">Shabaha</TableHead>
                <TableHead className="min-w-[140px]">Shughuli</TableHead>
                <TableHead className="min-w-[220px]">Account</TableHead>
                <TableHead className="min-w-[100px] text-right">Amount</TableHead>
                <TableHead className="min-w-[160px]">Kiashiria</TableHead>
                <TableHead className="min-w-[160px]">Matokeo</TableHead>
                <TableHead className="min-w-[140px] whitespace-nowrap">Time frame</TableHead>
                <TableHead className="min-w-[140px]">Mhusika</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No budget lines.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((l) => {
                  const ctx = rowPlanningContext(l);
                  const b = one(l.budgets);
                  const ac = one(l.accounts);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="max-w-[200px] align-top break-words">{ctx.kipaumbele}</TableCell>
                      <TableCell className="max-w-[200px] align-top break-words">{ctx.lengo}</TableCell>
                      <TableCell className="max-w-[200px] align-top break-words">{ctx.shabaha}</TableCell>
                      <TableCell className="max-w-[220px] align-top break-words">{b?.name ?? "—"}</TableCell>
                      <TableCell className="w-[220px] min-w-[220px] max-w-[220px] align-top break-words">
                        {ac?.code} — {ac?.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap align-top">
                        {numberFormatter.format(Number(l.amount ?? 0))}
                      </TableCell>
                      <TableCell className="max-w-[240px] align-top whitespace-pre-wrap break-words text-muted-foreground">
                        {l.indicators?.trim() ? l.indicators : "—"}
                      </TableCell>
                      <TableCell className="max-w-[240px] align-top whitespace-pre-wrap break-words text-muted-foreground">
                        {l.results?.trim() ? l.results : "—"}
                      </TableCell>
                      <TableCell className="align-top text-muted-foreground whitespace-nowrap">
                        {timeframeLabel(l.timeframe_start, l.timeframe_end)}
                      </TableCell>
                      <TableCell className="max-w-[200px] align-top break-words">
                        {l.mhusika?.trim() ? l.mhusika : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {rows.length > 0 ? (
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell colSpan={5}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{numberFormatter.format(total)}</TableCell>
                  <TableCell colSpan={4} />
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
