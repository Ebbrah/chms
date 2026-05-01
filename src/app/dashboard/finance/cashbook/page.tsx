import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CashbookSection } from "./cashbook-section";

export default async function CashbookPage() {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code");
  const { data: cbAccounts } = await supabase
    .from("cashbook_accounts")
    .select("id, name, opening_balance, accounts(code)")
    .order("name");
  const { data: txns } = await supabase
    .from("cashbook_transactions")
    .select("*")
    .order("txn_date", { ascending: false })
    .limit(80);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cashbook</h1>
      </div>
      <CashbookSection
        glAccounts={accounts ?? []}
        cashbookAccounts={cbAccounts ?? []}
      />
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Cashbook</TableHead>
              <TableHead>Dir</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Payee / memo</TableHead>
              <TableHead>Posted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(txns ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No transactions.
                </TableCell>
              </TableRow>
            ) : (
              (txns ?? []).map((t) => {
                const cb = (cbAccounts ?? []).find((c) => c.id === t.cashbook_account_id);
                const gl = cb?.accounts as { code?: string } | null;
                return (
                  <TableRow key={t.id as string}>
                    <TableCell>{String(t.txn_date)}</TableCell>
                    <TableCell>
                      {cb?.name} ({gl?.code})
                    </TableCell>
                    <TableCell>{String(t.direction)}</TableCell>
                    <TableCell className="text-right">{Number(t.amount).toFixed(2)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {String(t.payee_payor ?? "")} {String(t.memo ?? "")}
                    </TableCell>
                    <TableCell>{t.journal_entry_id ? "yes" : "no"}</TableCell>
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
