"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postCashbookToLedger } from "@/lib/actions/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type GlAccount = { id: string; code?: string; name?: string };
type CashbookAccount = {
  id: string;
  name?: string;
  accounts?: { code?: string } | null;
};
type Txn = {
  id: string;
  txn_date: string;
  cashbook_account_id: string;
  direction: "in" | "out";
  amount: number;
  payee_payor?: string | null;
  memo?: string | null;
  journal_entry_id?: string | null;
  posting_account_id?: string | null;
};

export function CashbookTransactionsTable({
  transactions,
  cashbookAccounts,
  glAccounts,
}: {
  transactions: Txn[];
  cashbookAccounts: CashbookAccount[];
  glAccounts: GlAccount[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [postingByTxn, setPostingByTxn] = useState<Record<string, boolean>>({});
  const [offsetByTxn, setOffsetByTxn] = useState<Record<string, string>>(
    Object.fromEntries(transactions.map((t) => [t.id, glAccounts[0]?.id ?? ""])),
  );

  async function onPost(txnId: string) {
    const offset = String(offsetByTxn[txnId] ?? "").trim();
    if (!offset) {
      setMsg("Select an offset GL account before posting.");
      return;
    }
    setPostingByTxn((prev) => ({ ...prev, [txnId]: true }));
    setMsg(null);
    const res = await postCashbookToLedger(txnId, offset);
    setPostingByTxn((prev) => ({ ...prev, [txnId]: false }));
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setMsg("Transaction posted to ledger.");
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-md border border-border">
      {msg ? <p className="px-3 pt-3 text-sm text-muted-foreground">{msg}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Cashbook</TableHead>
            <TableHead>Dir</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Payee / memo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Offset account</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No transactions.
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((t) => {
              const cb = cashbookAccounts.find((c) => c.id === t.cashbook_account_id);
              const gl = cb?.accounts as { code?: string } | null;
              const posted = Boolean(t.journal_entry_id);
              return (
                <TableRow key={t.id}>
                  <TableCell>{String(t.txn_date)}</TableCell>
                  <TableCell>
                    {cb?.name} ({gl?.code ?? "—"})
                  </TableCell>
                  <TableCell>{String(t.direction)}</TableCell>
                  <TableCell className="text-right">{Number(t.amount).toFixed(2)}</TableCell>
                  <TableCell className="max-w-[220px] truncate">
                    {String(t.payee_payor ?? "")} {String(t.memo ?? "")}
                  </TableCell>
                  <TableCell>
                    {posted ? (
                      <Badge variant="secondary">Posted</Badge>
                    ) : (
                      <Badge variant="outline">Unposted</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={offsetByTxn[t.id] ?? ""}
                      onValueChange={(value) => setOffsetByTxn((prev) => ({ ...prev, [t.id]: value }))}
                      disabled={posted}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Select offset account" />
                      </SelectTrigger>
                      <SelectContent>
                        {glAccounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void onPost(t.id)}
                      disabled={posted || postingByTxn[t.id]}
                    >
                      {posted ? "Posted" : postingByTxn[t.id] ? "Posting..." : "Post"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
