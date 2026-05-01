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

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string }>;
}) {
  const params = await searchParams;
  const to = String(params.to ?? "").trim();
  const supabase = await createClient();
  const rows = await loadAccountBalances(supabase, undefined, to || undefined);

  const assets = rows
    .filter((r) => r.type === "asset")
    .map((r) => ({ ...r, amount: Math.max(0, r.debit - r.credit) }))
    .filter((r) => r.amount > 0.005);
  const liabilities = rows
    .filter((r) => r.type === "liability")
    .map((r) => ({ ...r, amount: Math.max(0, r.credit - r.debit) }))
    .filter((r) => r.amount > 0.005);
  const equity = rows
    .filter((r) => r.type === "equity")
    .map((r) => ({ ...r, amount: Math.max(0, r.credit - r.debit) }))
    .filter((r) => r.amount > 0.005);
  const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
  const totalEquity = equity.reduce((s, r) => s + r.amount, 0);
  const rhs = totalLiabilities + totalEquity;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Balance sheet</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">As at date</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex items-end gap-3">
            <div className="grid gap-1">
              <label htmlFor="bs-to" className="text-sm text-muted-foreground">To</label>
              <input id="bs-to" type="date" name="to" defaultValue={to} className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" />
            </div>
            <button type="submit" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Apply</button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assets</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Amount (TZS)</TableHead></TableRow></TableHeader>
            <TableBody>
              {assets.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.code} — {r.name}</TableCell>
                  <TableCell className="text-right">{formatAmountTZS(r.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow><TableCell className="font-semibold">Total assets</TableCell><TableCell className="text-right font-semibold">{formatAmountTZS(totalAssets)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Liabilities and equity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Amount (TZS)</TableHead></TableRow></TableHeader>
            <TableBody>
              {liabilities.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.code} — {r.name}</TableCell>
                  <TableCell className="text-right">{formatAmountTZS(r.amount)}</TableCell>
                </TableRow>
              ))}
              {equity.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.code} — {r.name}</TableCell>
                  <TableCell className="text-right">{formatAmountTZS(r.amount)}</TableCell>
                </TableRow>
              ))}
              <TableRow><TableCell className="font-semibold">Total liabilities + equity</TableCell><TableCell className="text-right font-semibold">{formatAmountTZS(rhs)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
