"use client";

import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmountTZS } from "@/lib/format/amount";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Row = {
  id: string;
  amount: number | string;
  received_at: string | null;
  /** Supabase may return a single object or a one-element array for FK embeds. */
  offering_types: { name?: string } | { name?: string }[] | null;
};

function typeName(o: Row["offering_types"]): string | undefined {
  if (!o) return undefined;
  if (Array.isArray(o)) return o[0]?.name;
  return o.name;
}

const LABELS = ["Ahadi", "Jengo", "Dayosisi"] as const;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function normType(name: string | undefined) {
  const n = String(name ?? "").toLowerCase();
  if (n.includes("ahadi")) return "Ahadi";
  if (n.includes("jengo")) return "Jengo";
  if (n.includes("maendeleo")) return "Maendeleo ya Dayosisi";
  return "Other";
}

export function MemberOfferingsClient({ rows }: { rows: Row[] }) {
  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const r of rows) {
      if (!r.received_at) continue;
      ys.add(new Date(r.received_at).getFullYear());
    }
    const list = Array.from(ys).sort((a, b) => b - a);
    return list.length ? list : [new Date().getFullYear()];
  }, [rows]);

  const [year, setYear] = useState(String(years[0] ?? new Date().getFullYear()));
  const [mode, setMode] = useState<"year" | "month" | "week" | "other">("year");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [weekNo, setWeekNo] = useState("1");
  const [otherStart, setOtherStart] = useState("");
  const [otherEnd, setOtherEnd] = useState("");

  const filtered = useMemo(() => {
    const y = Number(year);
    if (!Number.isFinite(y)) return rows;
    return rows.filter((r) => {
      if (!r.received_at) return false;
      const dt = new Date(r.received_at);
      if (mode === "year") return dt.getFullYear() === y;
      if (mode === "month") {
        const m = Number(month);
        return dt.getFullYear() === y && dt.getMonth() + 1 === m;
      }
      if (mode === "week") {
        const w = Math.min(54, Math.max(1, Number(weekNo) || 1));
        const jan4 = new Date(y, 0, 4);
        const jan4Day = jan4.getDay() || 7;
        const firstMonday = new Date(jan4);
        firstMonday.setDate(jan4.getDate() - jan4Day + 1);
        firstMonday.setHours(0, 0, 0, 0);
        const ws = new Date(firstMonday);
        ws.setDate(firstMonday.getDate() + (w - 1) * 7);
        const we = new Date(ws);
        we.setDate(ws.getDate() + 6);
        we.setHours(23, 59, 59, 999);
        return dt >= ws && dt <= we;
      }
      const os = otherStart ? new Date(`${otherStart}T00:00:00`) : null;
      const oe = otherEnd ? new Date(`${otherEnd}T23:59:59.999`) : null;
      if (!os || !oe || Number.isNaN(os.getTime()) || Number.isNaN(oe.getTime()) || os > oe) return false;
      return dt >= os && dt <= oe;
    });
  }, [rows, year, mode, month, weekNo, otherStart, otherEnd]);

  const pivoted = useMemo(() => {
    const map = new Map<
      string,
      { date: string; ahadi: number; jengo: number; maendeleo: number; other: number }
    >();
    for (const r of filtered) {
      if (!r.received_at) continue;
      const day = new Date(r.received_at).toISOString().slice(0, 10);
      const kind = normType(typeName(r.offering_types));
      const amt = Number(r.amount);
      if (!map.has(day)) {
        map.set(day, { date: day, ahadi: 0, jengo: 0, maendeleo: 0, other: 0 });
      }
      const row = map.get(day)!;
      if (kind === "Ahadi") row.ahadi += amt;
      else if (kind === "Jengo") row.jengo += amt;
      else if (kind === "Maendeleo ya Dayosisi") row.maendeleo += amt;
      else row.other += amt;
    }
    return Array.from(map.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [filtered]);

  const totals = useMemo(() => {
    return pivoted.reduce(
      (acc, p) => {
        acc.ahadi += p.ahadi;
        acc.jengo += p.jengo;
        acc.maendeleo += p.maendeleo;
        acc.other += p.other;
        return acc;
      },
      { ahadi: 0, jengo: 0, maendeleo: 0, other: 0 },
    );
  }, [pivoted]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-md border border-border p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid gap-2">
          <Label>Year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>View</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="year">Whole year</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === "month" ? (
          <div className="grid gap-2">
            <Label>Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {MONTH_NAMES[m - 1]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {mode === "week" ? (
          <div className="grid gap-2">
            <Label>Week</Label>
            <Select value={weekNo} onValueChange={setWeekNo}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 54 }, (_, i) => i + 1).map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    W{w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {mode === "other" ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="other-start">Start date</Label>
              <input
                id="other-start"
                type="date"
                className="flex h-9 w-[180px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={otherStart}
                onChange={(e) => setOtherStart(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="other-end">End date</Label>
              <input
                id="other-end"
                type="date"
                className="flex h-9 w-[180px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={otherEnd}
                onChange={(e) => setOtherEnd(e.target.value)}
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date of offering</TableHead>
              {LABELS.map((l) => (
                <TableHead key={l}>{l} (TZS)</TableHead>
              ))}
              <TableHead>Other (TZS)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pivoted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No offerings in this period.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {pivoted.map((p) => (
                  <TableRow key={p.date}>
                    <TableCell>{p.date}</TableCell>
                    <TableCell>{formatAmountTZS(p.ahadi)}</TableCell>
                    <TableCell>{formatAmountTZS(p.jengo)}</TableCell>
                    <TableCell>{formatAmountTZS(p.maendeleo)}</TableCell>
                    <TableCell>{p.other > 0 ? formatAmountTZS(p.other) : "—"}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="font-semibold">{formatAmountTZS(totals.ahadi)}</TableCell>
                  <TableCell className="font-semibold">{formatAmountTZS(totals.jengo)}</TableCell>
                  <TableCell className="font-semibold">{formatAmountTZS(totals.maendeleo)}</TableCell>
                  <TableCell className="font-semibold">
                    {totals.other > 0 ? formatAmountTZS(totals.other) : "—"}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
