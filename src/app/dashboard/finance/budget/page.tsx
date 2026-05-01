import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BudgetSection } from "./budget-section";
import { BudgetLinesTable, type LineRow } from "./budget-lines-table";

export default async function BudgetPage() {
  const supabase = await createClient();
  const { data: fiscalYears, error: fiscalYearsError } = await supabase
    .from("fiscal_years")
    .select("id, label")
    .order("start_date", { ascending: false });
  const { data: budgets, error: budgetsError } = await supabase
    .from("budgets")
    .select("id, name, status, committee_id, fiscal_years(label), committees(name)")
    .order("created_at", { ascending: false });
  const { data: committees, error: committeesError } = await supabase
    .from("committees")
    .select("id, name")
    .order("name");
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code");
  const { data: lines, error: linesError } = await supabase
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
    .limit(200);
  const { data: priorities, error: prioritiesError } = await supabase
    .from("planning_priorities")
    .select("id, name")
    .order("created_at", { ascending: false });
  const { data: goals, error: goalsError } = await supabase
    .from("planning_goals")
    .select("id, priority_id, name")
    .order("created_at", { ascending: false });
  const { data: targets, error: targetsError } = await supabase
    .from("planning_targets")
    .select("id, goal_id, name, indicator, expected_result")
    .order("created_at", { ascending: false });

  const queryErrors = [
    fiscalYearsError?.message,
    budgetsError?.message,
    committeesError?.message,
    accountsError?.message,
    linesError?.message,
    prioritiesError?.message,
    goalsError?.message,
    targetsError?.message,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
      </div>
      <BudgetSection
        fiscalYears={fiscalYears ?? []}
        budgets={budgets ?? []}
        accounts={accounts ?? []}
        committees={committees ?? []}
        priorities={priorities ?? []}
        goals={goals ?? []}
        targets={targets ?? []}
      />
      {queryErrors.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Failed to load some budget data: {queryErrors.join(" | ")}
        </div>
      ) : null}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Budget line table</h2>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/finance/budget/report">Full budget report</Link>
          </Button>
        </div>
        <div className="rounded-md border border-border">
          <div className="h-[520px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shabaha</TableHead>
                  <TableHead>Shughuli</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Timeline</TableHead>
                  <TableHead>Mhusika</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <BudgetLinesTable lines={(lines ?? []) as unknown as LineRow[]} />
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
