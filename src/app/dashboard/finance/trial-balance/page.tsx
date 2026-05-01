import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmountTZS } from "@/lib/format/amount";

type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

function isDebitNormal(type: string): boolean {
  return type === "asset" || type === "expense";
}

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const from = String(params.from ?? "").trim();
  const to = String(params.to ?? "").trim();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type, is_active")
    .order("code");

  let linesQuery = supabase
    .from("journal_lines")
    .select("debit, credit, account_id, journal_entries!inner(entry_date)");
  if (from) linesQuery = linesQuery.gte("journal_entries.entry_date", from);
  if (to) linesQuery = linesQuery.lte("journal_entries.entry_date", to);
  const { data: lines } = await linesQuery;

  const totalsByAccount = new Map<string, { debit: number; credit: number }>();
  for (const row of lines ?? []) {
    const accountId = String((row as { account_id?: string }).account_id ?? "");
    if (!accountId) continue;
    if (!totalsByAccount.has(accountId)) totalsByAccount.set(accountId, { debit: 0, credit: 0 });
    const entry = totalsByAccount.get(accountId)!;
    entry.debit += Number((row as { debit?: number }).debit ?? 0);
    entry.credit += Number((row as { credit?: number }).credit ?? 0);
  }

  const rows = (accounts ?? []).map((account) => {
    const sums = totalsByAccount.get(String(account.id)) ?? { debit: 0, credit: 0 };
    const movement = sums.debit - sums.credit;
    const normalDebit = isDebitNormal(String(account.type));
    let balanceDebit = 0;
    let balanceCredit = 0;
    if (normalDebit) {
      if (movement >= 0) balanceDebit = movement;
      else balanceCredit = Math.abs(movement);
    } else {
      if (movement <= 0) balanceCredit = Math.abs(movement);
      else balanceDebit = movement;
    }
    return {
      code: String(account.code ?? ""),
      name: String(account.name ?? ""),
      type: String(account.type ?? "") as AccountType,
      isActive: Boolean(account.is_active),
      debit: balanceDebit,
      credit: balanceCredit,
    };
  });

  const rowsWithBalance = rows.filter((r) => r.debit > 0.005 || r.credit > 0.005);
  const totalDebit = rowsWithBalance.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = rowsWithBalance.reduce((sum, r) => sum + r.credit, 0);
  const balanced = Math.abs(totalDebit - totalCredit) <= 0.01;

  const pageTitle =
    from && to
      ? `Trial balance (${from} to ${to})`
      : from
        ? `Trial balance (from ${from})`
        : to
          ? `Trial balance (to ${to})`
          : "Trial balance (all posted periods)";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trial balance</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Period filter</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <label htmlFor="tb-from" className="text-sm text-muted-foreground">
                From
              </label>
              <input
                id="tb-from"
                type="date"
                name="from"
                defaultValue={from}
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="tb-to" className="text-sm text-muted-foreground">
                To
              </label>
              <input
                id="tb-to"
                type="date"
                name="to"
                defaultValue={to}
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
            </div>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Apply
            </button>
            <a
              href="/dashboard/finance/trial-balance"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm"
            >
              Clear
            </a>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{pageTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Debit (TZS)</TableHead>
                <TableHead className="text-right">Credit (TZS)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsWithBalance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No journal balances found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                rowsWithBalance.map((row) => (
                  <TableRow key={`${row.code}:${row.name}`}>
                    <TableCell>{row.code || "—"}</TableCell>
                    <TableCell>{row.name || "—"}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell className="text-right">
                      {row.debit > 0 ? formatAmountTZS(row.debit) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.credit > 0 ? formatAmountTZS(row.credit) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">
                  Totals
                </TableCell>
                <TableCell className="text-right font-semibold">{formatAmountTZS(totalDebit)}</TableCell>
                <TableCell className="text-right font-semibold">{formatAmountTZS(totalCredit)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="px-4 pb-4 text-sm">
            <span className={balanced ? "text-emerald-600" : "text-destructive"}>
              {balanced
                ? "Balanced: total debits equal total credits."
                : "Unbalanced: total debits do not equal total credits. Check journal entries."}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
