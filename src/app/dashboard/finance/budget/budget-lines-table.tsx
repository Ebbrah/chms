"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteBudgetLine, updateBudgetLine, updateBudgetLineDetails } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type LineRow, one, rowPlanningContext, timeframeLabel } from "./budget-line-model";

export type { LineRow } from "./budget-line-model";

const COL_COUNT = 7;

export function BudgetLinesTable({ lines }: { lines: LineRow[] }) {
  const router = useRouter();
  const numberFormatter = useMemo(() => new Intl.NumberFormat("en-US"), []);
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [msg, setMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [indicators, setIndicators] = useState("");
  const [results, setResults] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [mhusika, setMhusika] = useState("");

  const byId = useMemo(() => new Map(lines.map((l) => [l.id, l])), [lines]);
  const totalPages = Math.max(1, Math.ceil(lines.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedLines = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return lines.slice(startIndex, startIndex + pageSize);
  }, [lines, currentPage]);
  const totalAmount = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0),
    [lines],
  );

  const viewRow = viewId ? byId.get(viewId) : undefined;

  function openView(l: LineRow) {
    setViewId(l.id);
    setIndicators(String(l.indicators ?? ""));
    setResults(String(l.results ?? ""));
    setStart(String(l.timeframe_start ?? ""));
    setEnd(String(l.timeframe_end ?? ""));
    setMhusika(String(l.mhusika ?? ""));
  }

  async function onSave() {
    if (!editingId) return;
    setMsg(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) {
      setMsg("Invalid amount");
      return;
    }
    const fd = new FormData();
    fd.set("id", editingId);
    fd.set("amount", String(n));
    const res = await updateBudgetLine(fd);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setEditingId(null);
    setAmount("");
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this budget line?")) return;
    setMsg(null);
    const res = await deleteBudgetLine(id);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    if (editingId === id) {
      setEditingId(null);
      setAmount("");
    }
    if (viewId === id) {
      setViewId(null);
    }
    router.refresh();
  }

  async function onSaveDetails() {
    if (!viewId) return;
    setMsg(null);
    const fd = new FormData();
    fd.set("id", viewId);
    fd.set("indicators", indicators);
    fd.set("results", results);
    fd.set("timeframe_start", start);
    fd.set("timeframe_end", end);
    fd.set("mhusika", mhusika);
    const res = await updateBudgetLineDetails(fd);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setViewId(null);
    setIndicators("");
    setResults("");
    setStart("");
    setEnd("");
    setMhusika("");
    router.refresh();
  }

  const viewCtx = viewRow ? rowPlanningContext(viewRow) : null;
  const viewBudget = viewRow ? one(viewRow.budgets) : null;
  const viewAccount = viewRow ? one(viewRow.accounts) : null;

  return (
    <>
      <Dialog
        open={Boolean(viewId)}
        onOpenChange={(open) => {
          if (open) return;
          setViewId(null);
          setIndicators("");
          setResults("");
          setStart("");
          setEnd("");
          setMhusika("");
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Maelezo kamili ya mstari wa bajeti</DialogTitle>
          </DialogHeader>
          {viewRow && viewCtx ? (
            <div className="grid gap-6">
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="table-fixed w-full min-w-[1180px] border-collapse text-sm">
                    <colgroup>
                      <col style={{ width: 112 }} />
                      <col style={{ width: 112 }} />
                      <col style={{ width: 112 }} />
                      <col style={{ width: 152 }} />
                      <col style={{ width: 220 }} />
                      <col style={{ width: 108 }} />
                      <col style={{ width: 168 }} />
                      <col style={{ width: 168 }} />
                      <col style={{ width: 132 }} />
                      <col style={{ width: 140 }} />
                    </colgroup>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-normal break-words">Kipaumbele</TableHead>
                        <TableHead className="whitespace-normal break-words">Lengo</TableHead>
                        <TableHead className="whitespace-normal break-words">Shabaha</TableHead>
                        <TableHead className="whitespace-normal break-words">Shughuli</TableHead>
                        <TableHead className="align-top whitespace-normal break-words">Account</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Amount</TableHead>
                        <TableHead className="whitespace-normal break-words">Kiashiria</TableHead>
                        <TableHead className="whitespace-normal break-words">Matokeo</TableHead>
                        <TableHead className="whitespace-nowrap">Time frame</TableHead>
                        <TableHead className="whitespace-normal break-words">Mhusika</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="align-top break-words">{viewCtx.kipaumbele}</TableCell>
                        <TableCell className="align-top break-words">{viewCtx.lengo}</TableCell>
                        <TableCell className="align-top break-words">{viewCtx.shabaha}</TableCell>
                        <TableCell className="align-top break-words">{viewBudget?.name ?? "—"}</TableCell>
                        <TableCell className="align-top break-words text-left">
                          {viewAccount?.code} — {viewAccount?.name}
                        </TableCell>
                        <TableCell className="align-top text-right tabular-nums whitespace-nowrap">
                          {numberFormatter.format(Number(viewRow.amount ?? 0))}
                        </TableCell>
                        <TableCell className="align-top whitespace-pre-wrap break-words text-muted-foreground">
                          {viewRow.indicators?.trim() ? viewRow.indicators : "—"}
                        </TableCell>
                        <TableCell className="align-top whitespace-pre-wrap break-words text-muted-foreground">
                          {viewRow.results?.trim() ? viewRow.results : "—"}
                        </TableCell>
                        <TableCell className="align-top text-muted-foreground whitespace-nowrap">
                          {timeframeLabel(viewRow.timeframe_start, viewRow.timeframe_end)}
                        </TableCell>
                        <TableCell className="align-top break-words text-muted-foreground">
                          {viewRow.mhusika?.trim() ? viewRow.mhusika : "—"}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </table>
                </div>
              </div>

              <div className="grid gap-4 border-t pt-4">
                <p className="text-sm font-medium">Hariri ufuatiliaji (mstari huu)</p>
                <div className="grid gap-2">
                  <Label htmlFor="view-ind">Kiashiria</Label>
                  <Textarea
                    id="view-ind"
                    value={indicators}
                    onChange={(e) => setIndicators(e.target.value)}
                    placeholder="e.g. Idadi ya viti vilivyonunuliwa = 200"
                    disabled={String(viewBudget?.status ?? "") === "approved"}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="view-res">Matokeo</Label>
                  <Textarea
                    id="view-res"
                    value={results}
                    onChange={(e) => setResults(e.target.value)}
                    placeholder="e.g. Viti 150 vimenunuliwa na vimepokelewa"
                    disabled={String(viewBudget?.status ?? "") === "approved"}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="view-ts">Time frame start</Label>
                    <Input
                      id="view-ts"
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      disabled={String(viewBudget?.status ?? "") === "approved"}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="view-te">Time frame end</Label>
                    <Input
                      id="view-te"
                      type="date"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      disabled={String(viewBudget?.status ?? "") === "approved"}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="view-mh">Mhusika</Label>
                  <Input
                    id="view-mh"
                    value={mhusika}
                    onChange={(e) => setMhusika(e.target.value)}
                    placeholder="Mfano: Kamati ya malezi"
                    disabled={String(viewBudget?.status ?? "") === "approved"}
                  />
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewId(null)}>
              Close
            </Button>
            <Button
              type="button"
              onClick={() => void onSaveDetails()}
              disabled={!viewRow || String(viewBudget?.status ?? "") === "approved"}
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {msg ? (
        <TableBody>
          <TableRow>
            <TableCell colSpan={COL_COUNT} className="text-sm text-muted-foreground">
              {msg}
            </TableCell>
          </TableRow>
        </TableBody>
      ) : null}
      <TableBody>
        {pagedLines.length === 0 ? (
          <TableRow>
            <TableCell colSpan={COL_COUNT} className="text-center text-muted-foreground">
              No budget lines.
            </TableCell>
          </TableRow>
        ) : (
          pagedLines.map((l) => {
            const b = one(l.budgets);
            const ac = one(l.accounts);
            const isEditing = editingId === l.id;
            const status = String(b?.status ?? "");
            const ctx = rowPlanningContext(l);

            return (
              <TableRow key={l.id} className="group">
                <TableCell className="max-w-[200px] truncate" title={ctx.shabaha}>
                  {ctx.shabaha}
                </TableCell>
                <TableCell className="max-w-[220px] truncate" title={b?.name ?? ""}>
                  {b?.name ?? (l.budget_id ? `${l.budget_id.slice(0, 8)}…` : "—")}
                </TableCell>
                <TableCell className="max-w-[240px] truncate" title={`${ac?.code ?? ""} — ${ac?.name ?? ""}`}>
                  {ac?.code} — {ac?.name}
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <Input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="decimal"
                      className="ml-auto w-[140px] text-right"
                    />
                  ) : (
                    numberFormatter.format(Number(l.amount ?? 0))
                  )}
                </TableCell>
                <TableCell className="max-w-[200px] text-sm text-muted-foreground whitespace-nowrap">
                  {timeframeLabel(l.timeframe_start, l.timeframe_end)}
                </TableCell>
                <TableCell className="max-w-[160px] truncate text-sm" title={l.mhusika ?? ""}>
                  {l.mhusika?.trim() ? l.mhusika : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" onClick={() => void onSave()}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setAmount("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => openView(l)}
                      >
                        View
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={status === "approved"}
                        onClick={() => {
                          const row = byId.get(l.id);
                          if (!row) return;
                          setEditingId(l.id);
                          setAmount(String(row.amount ?? "0"));
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={status === "approved"}
                        onClick={() => void onDelete(l.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
        {lines.length > 0 ? (
          <TableRow className="sticky bottom-0 z-10 bg-background">
            <TableCell colSpan={3} className="font-semibold">
              Total
            </TableCell>
            <TableCell className="text-right font-semibold">
              {numberFormatter.format(totalAmount)}
            </TableCell>
            <TableCell colSpan={3} />
          </TableRow>
        ) : null}
      </TableBody>
      {lines.length > pageSize ? (
        <TableBody>
          <TableRow>
            <TableCell colSpan={COL_COUNT}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      ) : null}
    </>
  );
}
