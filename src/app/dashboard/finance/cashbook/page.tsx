import { createClient } from "@/lib/supabase/server";
import { CashbookSection } from "./cashbook-section";
import { CashbookTransactionsTable } from "./cashbook-transactions-table";

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
      <CashbookTransactionsTable
        transactions={
          ((txns ?? []) as {
            id: string;
            txn_date: string;
            cashbook_account_id: string;
            direction: "in" | "out";
            amount: number;
            payee_payor?: string | null;
            memo?: string | null;
            journal_entry_id?: string | null;
            posting_account_id?: string | null;
          }[])
        }
        cashbookAccounts={((cbAccounts ?? []) as { id: string; name?: string; accounts?: { code?: string } | null }[])}
        glAccounts={((accounts ?? []) as { id: string; code?: string; name?: string }[])}
      />
    </div>
  );
}
