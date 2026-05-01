import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReconciliationSection } from "./reconciliation-section";

export default async function BankReconciliationPage() {
  const supabase = await createClient();
  const { data: cashbookAccounts } = await supabase
    .from("cashbook_accounts")
    .select("id, name")
    .order("name");
  const { data: statementLines } = await supabase
    .from("bank_statement_lines")
    .select("id, statement_date, amount, direction, description, matched_at")
    .order("statement_date", { ascending: false })
    .limit(120);
  const { data: transactions } = await supabase
    .from("cashbook_transactions")
    .select("id, txn_date, amount, direction, payee_payor, memo")
    .order("txn_date", { ascending: false })
    .limit(120);
  const { data: matches } = await supabase
    .from("bank_reconciliation_matches")
    .select("id, statement_line_id, cashbook_transaction_id, matched_amount, matched_at")
    .order("matched_at", { ascending: false })
    .limit(120);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Bank reconciliation</h1>
      <ReconciliationSection
        cashbookAccounts={((cashbookAccounts ?? []) as { id: string; name?: string }[])}
        statementLines={((statementLines ?? []) as {
          id: string;
          statement_date: string;
          amount: number;
          direction: "in" | "out";
          description?: string | null;
        }[])}
        transactions={((transactions ?? []) as {
          id: string;
          txn_date: string;
          amount: number;
          direction: "in" | "out";
          payee_payor?: string | null;
          memo?: string | null;
        }[])}
      />

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Statement date</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(statementLines ?? []).map((s) => (
              <TableRow key={String(s.id)}>
                <TableCell>{String(s.statement_date)}</TableCell>
                <TableCell>{String(s.direction)}</TableCell>
                <TableCell className="text-right">{Number(s.amount).toFixed(2)}</TableCell>
                <TableCell>{String(s.description ?? "")}</TableCell>
                <TableCell>{s.matched_at ? "matched" : "unmatched"}</TableCell>
              </TableRow>
            ))}
            {(statementLines ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No statement lines yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matched at</TableHead>
              <TableHead>Statement line id</TableHead>
              <TableHead>Cashbook txn id</TableHead>
              <TableHead className="text-right">Matched amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(matches ?? []).map((m) => (
              <TableRow key={String(m.id)}>
                <TableCell>{String(m.matched_at)}</TableCell>
                <TableCell>{String(m.statement_line_id)}</TableCell>
                <TableCell>{String(m.cashbook_transaction_id)}</TableCell>
                <TableCell className="text-right">{Number(m.matched_amount).toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {(matches ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No matches yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
