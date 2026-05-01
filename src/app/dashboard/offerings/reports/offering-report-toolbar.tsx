"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export function OfferingReportToolbar() {
  const router = useRouter();
  const sp = useSearchParams();

  const range = sp.get("range") || "annual";
  const year = sp.get("year") || String(new Date().getFullYear());
  const quarter = sp.get("quarter") || "1";
  const half = sp.get("half") || "1";
  const month = sp.get("month") || String(new Date().getMonth() + 1);
  const weekNo = sp.get("weekNo") || "1";
  const start = sp.get("start") || "";
  const end = sp.get("end") || "";

  function push(next: Record<string, string>) {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      q.set(k, v);
    }
    router.push(`/dashboard/offerings/reports?${q.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="grid gap-2">
        <Label>Period</Label>
        <Select value={range} onValueChange={(v) => push({ range: v })}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="annual">Annual</SelectItem>
            <SelectItem value="semi_annual">Semi-annual</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label>Year</Label>
        <Select value={year} onValueChange={(v) => push({ year: v })}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {range === "semi_annual" ? (
        <div className="grid gap-2">
          <Label>Half</Label>
          <Select value={half} onValueChange={(v) => push({ half: v })}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">H1</SelectItem>
              <SelectItem value="2">H2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {range === "quarterly" ? (
        <div className="grid gap-2">
          <Label>Quarter</Label>
          <Select value={quarter} onValueChange={(v) => push({ quarter: v })}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((q) => (
                <SelectItem key={q} value={String(q)}>
                  Q{q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {range === "monthly" ? (
        <div className="grid gap-2">
          <Label>Month</Label>
          <Select value={month} onValueChange={(v) => push({ month: v })}>
            <SelectTrigger className="w-[160px]">
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
      {range === "weekly" ? (
        <div className="grid gap-2">
          <Label>Week</Label>
          <Select value={weekNo} onValueChange={(v) => push({ weekNo: v })}>
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
      {range === "other" ? (
        <>
          <div className="grid gap-2">
            <Label htmlFor="other-start">Start date</Label>
            <input
              id="other-start"
              type="date"
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              defaultValue={start}
              onChange={(e) => push({ start: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="other-end">End date</Label>
            <input
              id="other-end"
              type="date"
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              defaultValue={end}
              onChange={(e) => push({ end: e.target.value })}
            />
          </div>
        </>
      ) : null}
      <Button type="button" variant="outline" onClick={() => router.refresh()}>
        Refresh
      </Button>
    </div>
  );
}
