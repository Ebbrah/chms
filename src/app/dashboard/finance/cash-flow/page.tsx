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

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = String(params.from ?? "").trim();
  const to = String(params.to ?? "").trim();
  const supabase = await createClient();
  let q = supabase
    .from("cashbook_transactions")
    .select("id, txn_date, direction, amount, memo, payee_payor")
    .order("txn_date", { ascending: false });
  if (from) q = q.gte("txn_date", from);
  if (to) q = q.lte("txn_date", to);
  const { data: txns } = await q.limit(500);

  const inflow = (txns ?? [])
    .filter((t) => String(t.direction) === "in")
    .reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const outflow = (txns ?? [])
    .filter((t) => String(t.direction) === "out")
    .reduce((s, t) => s + Number(t.amount ?? 0), 0);
  const net = inflow - outflow;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cash flow</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Period filter</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <label htmlFor="cf-from" className="text-sm text-muted-foreground">From</label>
              <input id="cf-from" type="date" name="from" defaultValue={from} className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" />
            </div>
            <div className="grid gap-1">
              <label htmlFor="cf-to" className="text-sm text-muted-foreground">To</label>
              <input id="cf-to" type="date" name="to" defaultValue={to} className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" />
            </div>
            <button type="submit" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Apply</button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>Cash inflow: <strong>{formatAmountTZS(inflow)}</strong></p>
          <p>Cash outflow: <strong>{formatAmountTZS(outflow)}</strong></p>
          <p>Net cash movement: <strong>{formatAmountTZS(net)}</strong></p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Payee / memo</TableHead>
                <TableHead className="text-right">Amount (TZS)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(txns ?? []).map((t) => (
                <TableRow key={String(t.id)}>
                  <TableCell>{String(t.txn_date)}</TableCell>
                  <TableCell>{String(t.direction)}</TableCell>
                  <TableCell>{String(t.payee_payor ?? "")} {String(t.memo ?? "")}</TableCell>
                  <TableCell className="text-right">{formatAmountTZS(Number(t.amount ?? 0))}</TableCell>
                </TableRow>
              ))}
              {(txns ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">No cashbook activity in this period.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
