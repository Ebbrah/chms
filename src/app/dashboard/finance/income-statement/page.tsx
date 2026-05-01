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
import { loadAccountBalances } from "@/lib/finance/reports";

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = String(params.from ?? "").trim();
  const to = String(params.to ?? "").trim();
  const supabase = await createClient();
  const rows = await loadAccountBalances(supabase, from || undefined, to || undefined);

  const revenueRows = rows
    .filter((r) => r.type === "revenue")
    .map((r) => ({ ...r, amount: Math.max(0, r.credit - r.debit) }))
    .filter((r) => r.amount > 0.005);
  const expenseRows = rows
    .filter((r) => r.type === "expense")
    .map((r) => ({ ...r, amount: Math.max(0, r.debit - r.credit) }))
    .filter((r) => r.amount > 0.005);
  const totalRevenue = revenueRows.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenseRows.reduce((s, r) => s + r.amount, 0);
  const net = totalRevenue - totalExpense;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Income statement</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Period filter</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <label htmlFor="is-from" className="text-sm text-muted-foreground">From</label>
              <input id="is-from" type="date" name="from" defaultValue={from} className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" />
            </div>
            <div className="grid gap-1">
              <label htmlFor="is-to" className="text-sm text-muted-foreground">To</label>
              <input id="is-to" type="date" name="to" defaultValue={to} className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" />
            </div>
            <button type="submit" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Apply</button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Amount (TZS)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.code} — {r.name}</TableCell>
                  <TableCell className="text-right">{formatAmountTZS(r.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-semibold">Total revenue</TableCell>
                <TableCell className="text-right font-semibold">{formatAmountTZS(totalRevenue)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Expenses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Amount (TZS)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenseRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.code} — {r.name}</TableCell>
                  <TableCell className="text-right">{formatAmountTZS(r.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-semibold">Total expenses</TableCell>
                <TableCell className="text-right font-semibold">{formatAmountTZS(totalExpense)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Net surplus/(deficit)</TableCell>
                <TableCell className="text-right font-semibold">{formatAmountTZS(net)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
