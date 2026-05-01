"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  addCashbookTransaction,
  createCashbookAccount,
  postCashbookToLedger,
} from "@/lib/actions/finance";
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

type GL = { id: string; code?: string; name?: string };
type CB = { id: string; name?: string };

export function CashbookSection({
  glAccounts,
  cashbookAccounts,
}: {
  glAccounts: GL[];
  cashbookAccounts: CB[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [glLink, setGlLink] = useState("");
  const [cbId, setCbId] = useState("");
  const [dir, setDir] = useState<string>("in");
  const [offsetId, setOffsetId] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [txnAmount, setTxnAmount] = useState("");

  useEffect(() => {
    if (!glLink && glAccounts[0]) setGlLink(glAccounts[0].id);
    if (!cbId && cashbookAccounts[0]) setCbId(cashbookAccounts[0].id);
    if (!offsetId && glAccounts[1]) setOffsetId(glAccounts[1].id);
    else if (!offsetId && glAccounts[0]) setOffsetId(glAccounts[0].id);
  }, [glAccounts, cashbookAccounts, glLink, cbId, offsetId]);

  async function onCreateCb(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("account_id", glLink);
    fd.set("opening_balance", String(parseAmountInput(openingBalance)));
    const res = await createCashbookAccount(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Cashbook account created.");
      setOpeningBalance("0");
      router.refresh();
    }
  }

  async function onAddTxn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const a = parseAmountInput(txnAmount);
    if (!Number.isFinite(a) || a <= 0) {
      setMsg("Enter a valid amount greater than zero.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("cashbook_account_id", cbId);
    fd.set("direction", dir);
    fd.set("amount", String(a));
    const res = await addCashbookTransaction(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Transaction added.");
      setTxnAmount("");
      router.refresh();
    }
  }

  async function onPost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const tid = String(fd.get("transaction_id") || "");
    if (!tid) {
      setMsg("Enter transaction ID from the table or database.");
      return;
    }
    const res = await postCashbookToLedger(tid, offsetId);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Posted to ledger.");
      router.refresh();
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cashbook account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onCreateCb(e)} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="cb-name">Name</Label>
              <Input id="cb-name" name="name" placeholder="Main checking" required />
            </div>
            <div className="grid gap-2">
              <Label>GL account</Label>
              <Select value={glLink} onValueChange={setGlLink}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {glAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ob">Opening balance</Label>
              <CurrencyInput
                id="ob"
                value={openingBalance}
                onValueChange={setOpeningBalance}
                emptyZero={false}
              />
            </div>
            <Button type="submit">Create</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onAddTxn(e)} className="grid gap-3">
            <div className="grid gap-2">
              <Label>Cashbook</Label>
              <Select value={cbId} onValueChange={setCbId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cashbookAccounts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="txn_date">Date</Label>
              <Input id="txn_date" name="txn_date" type="date" required />
            </div>
            <div className="grid gap-2">
              <Label>Direction</Label>
              <Select value={dir} onValueChange={setDir}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">In</SelectItem>
                  <SelectItem value="out">Out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amt">Amount</Label>
              <CurrencyInput id="amt" value={txnAmount} onValueChange={setTxnAmount} emptyZero={false} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="payee">Payee / payer</Label>
              <Input id="payee" name="payee_payor" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="memo">Memo</Label>
              <Input id="memo" name="memo" />
            </div>
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Post to ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onPost(e)} className="grid gap-3">
            {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
            <div className="grid gap-2">
              <Label htmlFor="tid">Transaction ID</Label>
              <Input id="tid" name="transaction_id" placeholder="uuid" required />
            </div>
            <div className="grid gap-2">
              <Label>Offset GL account</Label>
              <Select value={offsetId} onValueChange={setOffsetId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {glAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Post</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
