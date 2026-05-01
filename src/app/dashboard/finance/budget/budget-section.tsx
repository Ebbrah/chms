"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  addBudgetLine,
  approveBudget,
  createBudget,
  createPlanningGoal,
  createPlanningPriority,
  createPlanningTarget,
  deleteBudget,
  updateBudget,
} from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { parseAmountInput } from "@/lib/format/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type FY = { id: string; label?: string };
type B = {
  id: string;
  name?: string;
  status?: string;
  committee_id?: string | null;
  fiscal_years?: { label?: string } | { label?: string }[] | null;
  committees?: { name?: string } | { name?: string }[] | null;
};

function fiscalLabel(b: B) {
  const f = b.fiscal_years;
  if (!f) return "";
  if (Array.isArray(f)) return f[0]?.label ?? "";
  return f.label ?? "";
}
type A = { id: string; code?: string; name?: string };
type C = { id: string; name?: string };
type P = { id: string; name?: string };
type G = { id: string; priority_id: string; name?: string };
type T = { id: string; goal_id: string; name?: string };

function committeeLabel(b: B) {
  const c = b.committees;
  if (!c) return "General";
  if (Array.isArray(c)) return c[0]?.name ?? "General";
  return c.name ?? "General";
}

export function BudgetSection({
  fiscalYears,
  budgets,
  accounts,
  committees,
  priorities,
  goals,
  targets,
}: {
  fiscalYears: FY[];
  budgets: B[];
  accounts: A[];
  committees: C[];
  priorities: P[];
  goals: G[];
  targets: T[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [budgetsPage, setBudgetsPage] = useState(1);
  const budgetPageSize = 10;
  const [fy, setFy] = useState("");
  const [budgetId, setBudgetId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [committeeId, setCommitteeId] = useState("");
  const [lineAmount, setLineAmount] = useState("");
  const [lineTargetId, setLineTargetId] = useState("");
  const [lineIndicators, setLineIndicators] = useState("");
  const [lineResults, setLineResults] = useState("");
  const [lineTimeframeStart, setLineTimeframeStart] = useState("");
  const [lineTimeframeEnd, setLineTimeframeEnd] = useState("");
  const [lineMhusika, setLineMhusika] = useState("");
  const [priorityName, setPriorityName] = useState("");
  const [goalPriorityId, setGoalPriorityId] = useState("");
  const [goalName, setGoalName] = useState("");
  /** Lengo selected only when creating a new Shabaha (not tied to budget line selection). */
  const [createShabahaGoalId, setCreateShabahaGoalId] = useState("");
  const [targetName, setTargetName] = useState("");
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editingBudgetName, setEditingBudgetName] = useState("");
  const [editingCommitteeId, setEditingCommitteeId] = useState<string>("");

  useEffect(() => {
    if (!fy && fiscalYears[0]) setFy(fiscalYears[0].id);
    if (!budgetId && budgets[0]) setBudgetId(budgets[0].id);
    if (!accountId && accounts[0]) setAccountId(accounts[0].id);
    if (!committeeId && committees[0]) setCommitteeId(committees[0].id);
    if (!goalPriorityId && priorities[0]) setGoalPriorityId(priorities[0].id);
    if (!createShabahaGoalId && goals[0]) setCreateShabahaGoalId(goals[0].id);
    if (!lineTargetId && targets[0]) setLineTargetId(targets[0].id);
  }, [
    fy,
    fiscalYears,
    budgets,
    budgetId,
    accounts,
    accountId,
    committeeId,
    committees,
    goalPriorityId,
    priorities,
    createShabahaGoalId,
    goals,
    lineTargetId,
    targets,
  ]);

  const goalsForPriority = useMemo(
    () => goals.filter((g) => g.priority_id === goalPriorityId),
    [goals, goalPriorityId],
  );
  const hierarchyRows = useMemo(
    () =>
      priorities.flatMap((priority) => {
        const relatedGoals = goals.filter((goal) => goal.priority_id === priority.id);
        if (relatedGoals.length === 0) {
          return [{ priority: priority.name ?? "—", goal: "—", target: "—" }];
        }
        return relatedGoals.flatMap((goal) => {
          const relatedTargets = targets.filter((target) => target.goal_id === goal.id);
          if (relatedTargets.length === 0) {
            return [{ priority: priority.name ?? "—", goal: goal.name ?? "—", target: "—" }];
          }
          return relatedTargets.map((target) => ({
            priority: priority.name ?? "—",
            goal: goal.name ?? "—",
            target: target.name ?? "—",
          }));
        });
      }),
    [priorities, goals, targets],
  );
  const budgetTotalPages = Math.max(1, Math.ceil(budgets.length / budgetPageSize));
  const currentBudgetPage = Math.min(budgetsPage, budgetTotalPages);
  const visibleBudgets = useMemo(() => {
    const startIndex = (currentBudgetPage - 1) * budgetPageSize;
    return budgets.slice(startIndex, startIndex + budgetPageSize);
  }, [budgets, currentBudgetPage]);
  useEffect(() => {
    if (!goalsForPriority.length) return;
    if (!goalsForPriority.some((g) => g.id === createShabahaGoalId)) {
      setCreateShabahaGoalId(goalsForPriority[0].id);
    }
  }, [goalsForPriority, createShabahaGoalId]);

  async function onCreatePriority(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const name = priorityName.trim();
    if (!name) {
      setMsg("Kipaumbele is required.");
      return;
    }
    const fd = new FormData();
    fd.set("name", name);
    const res = await createPlanningPriority(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setPriorityName("");
      setMsg("Kipaumbele saved.");
      router.refresh();
    }
  }

  async function onCreateGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const name = goalName.trim();
    if (!goalPriorityId || !name) {
      setMsg("Select Kipaumbele and enter Lengo.");
      return;
    }
    const fd = new FormData();
    fd.set("priority_id", goalPriorityId);
    fd.set("name", name);
    const res = await createPlanningGoal(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setGoalName("");
      setMsg("Lengo saved.");
      router.refresh();
    }
  }

  async function onCreateTarget(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const name = targetName.trim();
    if (!createShabahaGoalId || !name) {
      setMsg("Select Lengo and enter Shabaha.");
      return;
    }
    const fd = new FormData();
    fd.set("goal_id", createShabahaGoalId);
    fd.set("name", name);
    const res = await createPlanningTarget(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setTargetName("");
      setMsg("Shabaha saved.");
      router.refresh();
    }
  }

  async function onCreateBudget(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("fiscal_year_id", fy);
    if (committeeId) fd.set("committee_id", committeeId);
    const res = await createBudget(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Budget created.");
      form.reset();
      router.refresh();
    }
  }

  async function onAddLine(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    if (!lineAmount.trim()) {
      setMsg("Amount is required.");
      return;
    }
    const n = parseAmountInput(lineAmount);
    if (!Number.isFinite(n) || n < 0) {
      setMsg("Amount must be zero or greater.");
      return;
    }
    if (lineTimeframeStart && lineTimeframeEnd && lineTimeframeEnd < lineTimeframeStart) {
      setMsg("Time frame end must be on or after time frame start.");
      return;
    }

    const fd = new FormData();
    fd.set("budget_id", budgetId);
    fd.set("account_id", accountId);
    fd.set("target_id", lineTargetId);
    fd.set("amount", String(n));
    fd.set("indicators", lineIndicators);
    fd.set("results", lineResults);
    fd.set("timeframe_start", lineTimeframeStart);
    fd.set("timeframe_end", lineTimeframeEnd);
    fd.set("mhusika", lineMhusika);

    const res = await addBudgetLine(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Line saved.");
      setLineAmount("");
      setLineTargetId("");
      setLineIndicators("");
      setLineResults("");
      setLineTimeframeStart("");
      setLineTimeframeEnd("");
      setLineMhusika("");
      router.refresh();
    }
  }

  async function onApprove(id: string) {
    setMsg(null);
    const res = await approveBudget(id);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Budget approved.");
      router.refresh();
    }
  }

  async function onSaveBudget() {
    if (!editingBudgetId) return;
    setMsg(null);
    const fd = new FormData();
    fd.set("id", editingBudgetId);
    fd.set("name", editingBudgetName);
    fd.set("committee_id", editingCommitteeId);
    const res = await updateBudget(fd);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setEditingBudgetId(null);
    setEditingBudgetName("");
    setEditingCommitteeId("");
    router.refresh();
  }

  async function onDeleteBudget(id: string) {
    if (!confirm("Delete this budget? This cannot be undone.")) return;
    setMsg(null);
    const res = await deleteBudget(id);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    if (editingBudgetId === id) {
      setEditingBudgetId(null);
      setEditingBudgetName("");
      setEditingCommitteeId("");
    }
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create Shughuli</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onCreateBudget(e)} className="grid gap-4">
            {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
            <div className="grid gap-2">
              <Label>Fiscal year</Label>
              <Select value={fy} onValueChange={setFy}>
                <SelectTrigger className="min-w-0 [&>span]:truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYears.map((f) => (
                    <SelectItem key={f.id} value={f.id} title={f.label ?? ""}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bname">Name</Label>
              <Input id="bname" name="name" required />
            </div>
            <div className="grid gap-2">
              <Label>Committee</Label>
              <Select value={committeeId} onValueChange={setCommitteeId}>
                <SelectTrigger className="min-w-0 [&>span]:truncate">
                  <SelectValue placeholder="Select committee" />
                </SelectTrigger>
                <SelectContent>
                  {committees.map((c) => (
                    <SelectItem key={c.id} value={c.id} title={c.name ?? ""}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Create</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Mpangilio (Kipaumbele, Lengo, Shabaha)</CardTitle>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-4">
          <form onSubmit={(e) => void onCreatePriority(e)} className="grid gap-2">
            <Label htmlFor="priority-name">Kipaumbele</Label>
            <div className="flex gap-2">
              <Input
                id="priority-name"
                value={priorityName}
                onChange={(e) => setPriorityName(e.target.value)}
                placeholder="Mfano: Uinjilisti wa vijana"
              />
              <Button type="submit" variant="outline">Hifadhi</Button>
            </div>
          </form>

          <form onSubmit={(e) => void onCreateGoal(e)} className="grid gap-2">
            <Label>Lengo</Label>
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <Select value={goalPriorityId} onValueChange={setGoalPriorityId}>
                <SelectTrigger className="min-w-0 [&>span]:truncate">
                  <SelectValue placeholder="Chagua Kipaumbele" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.id} value={p.id} title={p.name ?? ""}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="Andika Lengo" />
              <Button type="submit" variant="outline">Hifadhi</Button>
            </div>
          </form>

          <form onSubmit={(e) => void onCreateTarget(e)} className="grid gap-2">
            <Label>Shabaha</Label>
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
              <Select value={createShabahaGoalId} onValueChange={setCreateShabahaGoalId}>
                <SelectTrigger className="min-w-0 [&>span]:truncate">
                  <SelectValue placeholder="Chagua Lengo" />
                </SelectTrigger>
                <SelectContent>
                  {(goalPriorityId ? goalsForPriority : goals).map((g) => (
                    <SelectItem key={g.id} value={g.id} title={g.name ?? ""}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={targetName} onChange={(e) => setTargetName(e.target.value)} placeholder="Andika Shabaha" />
            </div>
            <div>
              <Button type="submit" variant="outline">Hifadhi</Button>
            </div>
          </form>

          <div className="grid gap-2">
            <Label>Hierarchy view (read-only)</Label>
            <div className="rounded-md border">
              <div className="max-h-48 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kipaumbele</TableHead>
                      <TableHead>Lengo</TableHead>
                      <TableHead>Shabaha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hierarchyRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Hakuna data ya mpangilio bado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      hierarchyRows.map((row, idx) => (
                        <TableRow key={`${row.priority}-${row.goal}-${row.target}-${idx}`}>
                          <TableCell className="max-w-[220px] truncate" title={row.priority}>{row.priority}</TableCell>
                          <TableCell className="max-w-[220px] truncate" title={row.goal}>{row.goal}</TableCell>
                          <TableCell className="max-w-[220px] truncate" title={row.target}>{row.target}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Budget line</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0">
          <form onSubmit={(e) => void onAddLine(e)} className="grid min-w-0 gap-4">
            <div className="grid gap-2">
              <Label>Shabaha</Label>
              <Select value={lineTargetId} onValueChange={setLineTargetId}>
                <SelectTrigger className="min-w-0 [&>span]:truncate">
                  <SelectValue placeholder="Chagua Shabaha" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="block max-w-[22rem] truncate" title={t.name ?? ""}>
                        {t.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Shughuli (Budget)</Label>
              <Select value={budgetId} onValueChange={setBudgetId}>
                <SelectTrigger className="min-w-0 [&>span]:truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {budgets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <span
                        className="block max-w-[22rem] truncate"
                        title={`${b.name} (${b.status}) — ${fiscalLabel(b)} · ${committeeLabel(b)}`}
                      >
                        {b.name} ({b.status}) — {fiscalLabel(b)} · {committeeLabel(b)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="min-w-0 [&>span]:truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="block max-w-[22rem] truncate" title={`${a.code} — ${a.name}`}>
                        {a.code} — {a.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bamount">Amount</Label>
              <CurrencyInput
                id="bamount"
                value={lineAmount}
                onValueChange={setLineAmount}
                emptyZero={false}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bindicators">Kiashiria</Label>
              <Textarea
                id="bindicators"
                name="indicators"
                placeholder="e.g. Number of chairs purchased = 200"
                value={lineIndicators}
                onChange={(e) => setLineIndicators(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bresults">Matokeo</Label>
              <Textarea
                id="bresults"
                name="results"
                placeholder="e.g. 150 chairs purchased and received"
                value={lineResults}
                onChange={(e) => setLineResults(e.target.value)}
              />
            </div>
              <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="btimeframe-start">Time frame start</Label>
                <Input
                  id="btimeframe-start"
                  name="timeframe_start"
                  type="date"
                  value={lineTimeframeStart}
                  onChange={(e) => setLineTimeframeStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="btimeframe-end">Time frame end</Label>
                <Input
                  id="btimeframe-end"
                  name="timeframe_end"
                  type="date"
                  value={lineTimeframeEnd}
                  onChange={(e) => setLineTimeframeEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bmhusika">Mhusika</Label>
              <Input
                id="bmhusika"
                name="mhusika"
                placeholder="Mfano: Kamati ya malezi"
                value={lineMhusika}
                onChange={(e) => setLineMhusika(e.target.value)}
              />
            </div>
            <Button type="submit">Save line</Button>
          </form>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Shughuli</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[420px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No budgets.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleBudgets.map((b) => (
                  <TableRow key={b.id} className="group">
                    <TableCell className="max-w-[320px] truncate" title={String(b.name ?? "")}>
                      {editingBudgetId === b.id ? (
                        <Input
                          value={editingBudgetName}
                          onChange={(e) => setEditingBudgetName(e.target.value)}
                        />
                      ) : (
                        b.name
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate" title={fiscalLabel(b)}>{fiscalLabel(b)}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={`${b.status ?? ""} · ${committeeLabel(b)}`}>
                      {b.status} · {committeeLabel(b)}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingBudgetId === b.id ? (
                        <div className="flex justify-end gap-2">
                          <div className="w-[220px]">
                            <Select
                              value={editingCommitteeId}
                              onValueChange={setEditingCommitteeId}
                            >
                              <SelectTrigger className="min-w-0 [&>span]:truncate">
                                <SelectValue placeholder="Committee" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">General</SelectItem>
                                {committees.map((c) => (
                                  <SelectItem key={c.id} value={c.id} title={c.name ?? ""}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button type="button" size="sm" onClick={() => void onSaveBudget()}>
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingBudgetId(null);
                              setEditingBudgetName("");
                              setEditingCommitteeId("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {b.status === "draft" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => void onApprove(b.id)}
                            >
                              Approve
                            </Button>
                          ) : null}
                          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingBudgetId(b.id);
                                setEditingBudgetName(String(b.name ?? ""));
                                setEditingCommitteeId(typeof b.committee_id === "string" ? b.committee_id : "");
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => void onDeleteBudget(b.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                  ))
                )}
                {budgets.length > budgetPageSize ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Page {currentBudgetPage} of {budgetTotalPages}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={currentBudgetPage <= 1}
                            onClick={() => setBudgetsPage((prev) => Math.max(1, prev - 1))}
                          >
                            Previous
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={currentBudgetPage >= budgetTotalPages}
                            onClick={() => setBudgetsPage((prev) => Math.min(budgetTotalPages, prev + 1))}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
