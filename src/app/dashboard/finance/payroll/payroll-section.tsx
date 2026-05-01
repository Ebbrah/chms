"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  addPayrollLine,
  createEmployee,
  createPayrollRun,
  postPayrollRun,
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

type E = { id: string; name?: string };
type R = { id: string; period_start?: string; period_end?: string; status?: string };
type A = { id: string; code?: string; name?: string };

export function PayrollSection({
  employees,
  runs,
  accounts,
}: {
  employees: E[];
  runs: R[];
  accounts: A[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [runId, setRunId] = useState("");
  const [empId, setEmpId] = useState("");
  const [expId, setExpId] = useState("");
  const [cashId, setCashId] = useState("");
  const [liabId, setLiabId] = useState("");
  const [postRunId, setPostRunId] = useState("");
  const [baseAmount, setBaseAmount] = useState("");
  const [lineGross, setLineGross] = useState("");
  const [lineNet, setLineNet] = useState("");

  useEffect(() => {
    if (!runId && runs[0]) setRunId(runs[0].id);
    if (!empId && employees[0]) setEmpId(employees[0].id);
    if (!postRunId && runs[0]) setPostRunId(runs[0].id);
    if (!expId && accounts[0]) setExpId(accounts[0].id);
    if (!cashId && accounts[1]) setCashId(accounts[1].id);
    else if (!cashId && accounts[0]) setCashId(accounts[0].id);
    if (!liabId && accounts[2]) setLiabId(accounts[2].id);
    else if (!liabId && accounts[0]) setLiabId(accounts[0].id);
  }, [runs, runId, employees, empId, accounts, expId, cashId, liabId, postRunId]);

  async function onEmp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    if (baseAmount.trim()) fd.set("base_amount", String(parseAmountInput(baseAmount)));
    const res = await createEmployee(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Employee added.");
      setBaseAmount("");
      router.refresh();
    }
  }

  async function onRun(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const res = await createPayrollRun(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Payroll run created.");
      router.refresh();
    }
  }

  async function onLine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const g = parseAmountInput(lineGross);
    const n = parseAmountInput(lineNet);
    if (!Number.isFinite(g) || !Number.isFinite(n) || g <= 0 || n <= 0) {
      setMsg("Enter valid gross and net amounts greater than zero.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("payroll_run_id", runId);
    fd.set("employee_id", empId);
    fd.set("gross", String(g));
    fd.set("net", String(n));
    const res = await addPayrollLine(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Line added.");
      setLineGross("");
      setLineNet("");
      router.refresh();
    }
  }

  async function onPost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const res = await postPayrollRun(postRunId, expId, cashId, liabId);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Payroll posted.");
      router.refresh();
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employee</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onEmp(e)} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ename">Name</Label>
              <Input id="ename" name="name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="etitle">Title</Label>
              <Input id="etitle" name="role_title" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ebase">Base amount</Label>
              <CurrencyInput id="ebase" value={baseAmount} onValueChange={setBaseAmount} />
            </div>
            <Button type="submit">Add employee</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payroll run</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onRun(e)} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ps">Period start</Label>
              <Input id="ps" name="period_start" type="date" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pe">Period end</Label>
              <Input id="pe" name="period_end" type="date" required />
            </div>
            <Button type="submit">Create run</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payroll line</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onLine(e)} className="grid gap-3">
            <div className="grid gap-2">
              <Label>Run</Label>
              <Select value={runId} onValueChange={setRunId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.period_start} → {r.period_end} ({r.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Employee</Label>
              <Select value={empId} onValueChange={setEmpId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {x.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gross">Gross</Label>
              <CurrencyInput id="gross" value={lineGross} onValueChange={setLineGross} emptyZero={false} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="net">Net</Label>
              <CurrencyInput id="net" value={lineNet} onValueChange={setLineNet} emptyZero={false} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ded">Deductions JSON</Label>
              <Input id="ded" name="deductions_json" defaultValue="[]" />
            </div>
            <Button type="submit">Add line</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Post run to ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onPost(e)} className="grid gap-3">
            {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
            <div className="grid gap-2">
              <Label>Run</Label>
              <Select value={postRunId} onValueChange={setPostRunId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.period_start} → {r.period_end}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Salary expense</Label>
              <Select value={expId} onValueChange={setExpId}>
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
              <Label>Cash / bank</Label>
              <Select value={cashId} onValueChange={setCashId}>
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
              <Label>Withholdings payable</Label>
              <Select value={liabId} onValueChange={setLiabId}>
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
            <Button type="submit">Post</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
