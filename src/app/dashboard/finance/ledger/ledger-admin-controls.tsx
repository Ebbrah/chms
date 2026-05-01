"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addOpeningBalanceLine,
  closeAccountingPeriod,
  createOpeningBalanceBatch,
  postOpeningBalanceBatch,
  reopenAccountingPeriod,
} from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type Account = { id: string; code?: string; name?: string };
type FiscalYear = { id: string; label?: string };
type Batch = { id: string; period_month: string; version: number; status: string };

export function LedgerAdminControls({
  accounts,
  fiscalYears,
  batches,
}: {
  accounts: Account[];
  fiscalYears: FiscalYear[];
  batches: Batch[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [periodMonth, setPeriodMonth] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [reopenReason, setReopenReason] = useState("");

  const [batchPeriodMonth, setBatchPeriodMonth] = useState("");
  const [batchFiscalYear, setBatchFiscalYear] = useState(fiscalYears[0]?.id ?? "__none__");
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "__none__");

  const [lineBatchId, setLineBatchId] = useState(batches[0]?.id ?? "__none__");
  const [lineAccountId, setLineAccountId] = useState(accounts[0]?.id ?? "__none__");
  const [lineDebit, setLineDebit] = useState("");
  const [lineCredit, setLineCredit] = useState("");
  const [lineMemo, setLineMemo] = useState("");

  async function onClosePeriod() {
    setMsg(null);
    if (!periodMonth) return setMsg("Choose a month.");
    const res = await closeAccountingPeriod(`${periodMonth}-01`, closeReason);
    if ("error" in res && res.error) return setMsg(res.error);
    setMsg("Period closed.");
    router.refresh();
  }

  async function onReopenPeriod() {
    setMsg(null);
    if (!periodMonth) return setMsg("Choose a month.");
    const res = await reopenAccountingPeriod(`${periodMonth}-01`, reopenReason);
    if ("error" in res && res.error) return setMsg(res.error);
    setMsg("Period reopened.");
    router.refresh();
  }

  async function onCreateBatch() {
    setMsg(null);
    if (!batchPeriodMonth) return setMsg("Choose opening-balance month.");
    const fd = new FormData();
    fd.set("period_month", `${batchPeriodMonth}-01`);
    if (batchFiscalYear !== "__none__") fd.set("fiscal_year_id", batchFiscalYear);
    const res = await createOpeningBalanceBatch(fd);
    if ("error" in res && res.error) return setMsg(res.error);
    setMsg("Opening balance batch created.");
    router.refresh();
  }

  async function onAddLine() {
    setMsg(null);
    if (lineBatchId === "__none__" || lineAccountId === "__none__") return setMsg("Select batch and account.");
    const d = parseAmountInput(lineDebit);
    const c = parseAmountInput(lineCredit);
    const fd = new FormData();
    fd.set("batch_id", lineBatchId);
    fd.set("account_id", lineAccountId);
    fd.set("debit", String(Number.isFinite(d) ? d : 0));
    fd.set("credit", String(Number.isFinite(c) ? c : 0));
    fd.set("memo", lineMemo);
    const res = await addOpeningBalanceLine(fd);
    if ("error" in res && res.error) return setMsg(res.error);
    setMsg("Opening balance line added.");
    setLineDebit("");
    setLineCredit("");
    setLineMemo("");
    router.refresh();
  }

  async function onPostBatch() {
    setMsg(null);
    if (batchId === "__none__") return setMsg("Select batch.");
    const res = await postOpeningBalanceBatch(batchId);
    if ("error" in res && res.error) return setMsg(res.error);
    setMsg("Opening balance batch posted.");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Period control (month)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
          <div className="grid gap-1">
            <Label>Month</Label>
            <Input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Close reason (optional)</Label>
            <Input value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
          </div>
          <Button type="button" onClick={() => void onClosePeriod()}>
            Close month
          </Button>
          <div className="grid gap-1">
            <Label>Reopen reason (required)</Label>
            <Input value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={() => void onReopenPeriod()}>
            Reopen month
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opening balance batch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-1">
            <Label>Month</Label>
            <Input type="month" value={batchPeriodMonth} onChange={(e) => setBatchPeriodMonth(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label>Fiscal year (optional)</Label>
            <Select value={batchFiscalYear} onValueChange={setBatchFiscalYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {fiscalYears.map((fy) => (
                  <SelectItem key={fy.id} value={fy.id}>
                    {fy.label ?? fy.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={() => void onCreateBatch()}>
            Create batch
          </Button>
          <div className="grid gap-1">
            <Label>Post draft batch</Label>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select batch</SelectItem>
                {batches.filter((b) => b.status === "draft").map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.period_month.slice(0, 7)} v{b.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={() => void onPostBatch()}>
            Post batch
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opening balance lines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-1">
            <Label>Batch</Label>
            <Select value={lineBatchId} onValueChange={setLineBatchId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select batch</SelectItem>
                {batches.filter((b) => b.status === "draft").map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.period_month.slice(0, 7)} v{b.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Account</Label>
            <Select value={lineAccountId} onValueChange={setLineAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select account</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Debit" value={lineDebit} onChange={(e) => setLineDebit(e.target.value)} />
            <Input placeholder="Credit" value={lineCredit} onChange={(e) => setLineCredit(e.target.value)} />
          </div>
          <Input placeholder="Memo" value={lineMemo} onChange={(e) => setLineMemo(e.target.value)} />
          <Button type="button" variant="outline" onClick={() => void onAddLine()}>
            Add line
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
