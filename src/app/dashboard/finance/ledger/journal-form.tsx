"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createManualJournal } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { parseAmountInput } from "@/lib/format/currency-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type A = { id: string; code?: string; name?: string };

export function JournalForm({ accounts }: { accounts: A[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [debitId, setDebitId] = useState("");
  const [creditId, setCreditId] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!debitId && accounts[0]) setDebitId(accounts[0].id);
    if (!creditId && accounts[1]) setCreditId(accounts[1].id);
    else if (!creditId && accounts[0]) setCreditId(accounts[0].id);
  }, [accounts, debitId, creditId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("account_debit", debitId);
    fd.set("account_credit", creditId);
    const a = parseAmountInput(amount);
    if (!Number.isFinite(a) || a <= 0) {
      setMsg("Enter a valid amount greater than zero.");
      return;
    }
    fd.set("amount", String(a));
    const res = await createManualJournal(fd);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setMsg("Posted.");
    setAmount("");
    router.refresh();
  }

  if (!accounts.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Manual journal</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Manual journal (2 lines)</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4 sm:grid-cols-2">
          {msg ? <p className="text-sm text-muted-foreground sm:col-span-2">{msg}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="entry_date">Date</Label>
            <Input id="entry_date" name="entry_date" type="date" required />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" />
          </div>
          <div className="grid gap-2">
            <Label>Debit account</Label>
            <Select value={debitId} onValueChange={setDebitId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Credit account</Label>
            <Select value={creditId} onValueChange={setCreditId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="amount">Amount</Label>
            <CurrencyInput id="amount" value={amount} onValueChange={setAmount} emptyZero={false} />
          </div>
          <Button type="submit" className="sm:col-span-2">
            Post journal
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
