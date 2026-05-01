"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addBankStatementLine,
  matchBankStatementToCashbook,
} from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseAmountInput } from "@/lib/format/currency-input";

type Cashbook = { id: string; name?: string };
type Statement = { id: string; statement_date: string; amount: number; direction: "in" | "out"; description?: string | null };
type Txn = { id: string; txn_date: string; amount: number; direction: "in" | "out"; payee_payor?: string | null; memo?: string | null };

export function ReconciliationSection({
  cashbookAccounts,
  statementLines,
  transactions,
}: {
  cashbookAccounts: Cashbook[];
  statementLines: Statement[];
  transactions: Txn[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [cbId, setCbId] = useState(cashbookAccounts[0]?.id ?? "");
  const [dir, setDir] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("");
  const [statementDate, setStatementDate] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [sid, setSid] = useState(statementLines[0]?.id ?? "__none__");
  const [tid, setTid] = useState(transactions[0]?.id ?? "__none__");

  async function onAddStatementLine() {
    setMsg(null);
    const amt = parseAmountInput(amount);
    if (!cbId || !statementDate || !Number.isFinite(amt) || amt <= 0) {
      setMsg("Provide cashbook, date and valid amount.");
      return;
    }
    const fd = new FormData();
    fd.set("cashbook_account_id", cbId);
    fd.set("statement_date", statementDate);
    fd.set("amount", String(amt));
    fd.set("direction", dir);
    fd.set("description", description);
    fd.set("reference", reference);
    const res = await addBankStatementLine(fd);
    if ("error" in res && res.error) return setMsg(res.error);
    setMsg("Statement line saved.");
    setAmount("");
    setDescription("");
    setReference("");
    router.refresh();
  }

  async function onMatch() {
    setMsg(null);
    if (sid === "__none__" || tid === "__none__") return setMsg("Select statement line and cashbook transaction.");
    const res = await matchBankStatementToCashbook(sid, tid);
    if ("error" in res && res.error) return setMsg(res.error);
    setMsg("Reconciliation match saved.");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-md border border-border p-4 space-y-3">
        <h2 className="text-base font-medium">Add statement line (manual)</h2>
        {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
        <div className="grid gap-1">
          <Label>Cashbook</Label>
          <Select value={cbId} onValueChange={setCbId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {cashbookAccounts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name ?? c.id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
          <Select value={dir} onValueChange={(v) => setDir(v as "in" | "out")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in">In</SelectItem>
              <SelectItem value="out">Out</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input placeholder="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        <Button type="button" onClick={() => void onAddStatementLine()}>Save statement line</Button>
      </div>

      <div className="rounded-md border border-border p-4 space-y-3">
        <h2 className="text-base font-medium">Match statement to cashbook</h2>
        <div className="grid gap-1">
          <Label>Statement line</Label>
          <Select value={sid} onValueChange={setSid}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select statement line</SelectItem>
              {statementLines.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.statement_date} · {s.direction} · {Number(s.amount).toFixed(2)} · {s.description ?? ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label>Cashbook transaction</Label>
          <Select value={tid} onValueChange={setTid}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select transaction</SelectItem>
              {transactions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.txn_date} · {t.direction} · {Number(t.amount).toFixed(2)} · {t.payee_payor ?? ""} {t.memo ?? ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={() => void onMatch()}>
          Match selected
        </Button>
      </div>
    </div>
  );
}
