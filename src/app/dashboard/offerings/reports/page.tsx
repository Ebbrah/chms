import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getMyRoles } from "@/lib/auth/session";
import { canFinance, hasRole } from "@/lib/auth/permissions";
import { userHeadsPlanningCommittee } from "@/lib/auth/planning-committee";
import { getReportRange } from "@/lib/offering/report-range";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAmountTZS } from "@/lib/format/amount";
import { offeringBatchSlotLabel } from "@/lib/offering/weekly";
import { OfferingReportToolbar } from "./offering-report-toolbar";

function normType(name: string | undefined) {
  const n = String(name ?? "").toLowerCase();
  if (n.includes("ahadi")) return "ahadi";
  if (n.includes("jengo")) return "jengo";
  if (n.includes("maendeleo")) return "maendeleo";
  return "other";
}

function pledgeText(details: Record<string, unknown> | null, key: string) {
  if (!details) return "—";
  const v = details[key];
  if (v === null || v === undefined || !String(v).trim()) return "—";
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? formatAmountTZS(n) : String(v);
}

export default async function OfferingReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const roles = await getMyRoles();
  const finance = canFinance(roles);
  const planningHead = await userHeadsPlanningCommittee();
  const committeeHead = hasRole(roles, "committee_head");
  if (!finance && !(committeeHead && planningHead)) {
    redirect("/dashboard");
  }

  const spRaw = await searchParams;
  const sp: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(spRaw)) {
    sp[k] = Array.isArray(v) ? v[0] : v;
  }

  const { label, start, end } = getReportRange(sp);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const reportRange = sp.range || "annual";
  const showAttendanceSummary = reportRange === "weekly" || reportRange === "monthly";
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const parsedPage = Number(sp.page ?? "1");
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
  const pageSize = 50;

  const supabase = await createClient();

  const { data: attendanceBatches } = showAttendanceSummary
    ? await supabase
        .from("offering_week_batches")
        .select(
          "week_start_date, week_end_date, batch_slot, men_attendance_count, women_attendance_count, sunday_school_children_count, status",
        )
        .in("batch_slot", [1, 2])
        .lte("week_start_date", endDate)
        .gte("week_end_date", startDate)
        .order("week_start_date", { ascending: true })
        .order("batch_slot", { ascending: true })
    : { data: [] };

  const attendanceRows = (attendanceBatches ?? []).map((b) => ({
    weekLabel: `${String(b.week_start_date)} → ${String(b.week_end_date)}`,
    batchLabel: offeringBatchSlotLabel(Number(b.batch_slot ?? 1)),
    men: b.men_attendance_count != null ? Number(b.men_attendance_count) : null,
    women: b.women_attendance_count != null ? Number(b.women_attendance_count) : null,
    children:
      b.sunday_school_children_count != null ? Number(b.sunday_school_children_count) : null,
    status: String(b.status ?? ""),
  }));

  const attendanceTotals = attendanceRows.reduce(
    (acc, row) => {
      if (row.men != null) acc.men += row.men;
      if (row.women != null) acc.women += row.women;
      if (row.children != null) acc.children += row.children;
      return acc;
    },
    { men: 0, women: 0, children: 0 },
  );

  const { data: members } = await supabase
    .from("members")
    .select("id, user_id, offering_number, member_details")
    .order("offering_number", { ascending: true })
    .limit(5000);

  const userIds = (members ?? [])
    .map((m) => m.user_id)
    .filter((x): x is string => Boolean(x));
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] };

  const nameByUser = new Map<string, string>();
  for (const p of profiles ?? []) {
    nameByUser.set(p.id, p.full_name ?? "—");
  }

  const { data: offeringRows } = await supabase
    .from("offerings")
    .select("member_id, amount, offering_types(name)")
    .gte("received_at", startIso)
    .lte("received_at", endIso)
    .limit(100000);

  const sums = new Map<
    string,
    { ahadi: number; jengo: number; maendeleo: number; other: number }
  >();

  for (const m of members ?? []) {
    sums.set(m.id, { ahadi: 0, jengo: 0, maendeleo: 0, other: 0 });
  }

  for (const o of offeringRows ?? []) {
    const mid = o.member_id as string | null;
    if (!mid || !sums.has(mid)) continue;
    const bucket = sums.get(mid)!;
    const otRaw = o.offering_types as { name?: string } | { name?: string }[] | null;
    const nm = Array.isArray(otRaw) ? otRaw[0]?.name : otRaw?.name;
    const t = normType(nm);
    const amt = Number(o.amount);
    if (t === "ahadi") bucket.ahadi += amt;
    else if (t === "jengo") bucket.jengo += amt;
    else if (t === "maendeleo") bucket.maendeleo += amt;
    else bucket.other += amt;
  }

  const totalRows = (members ?? []).length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize;
  const pagedMembers = (members ?? []).slice(from, to);
  const pageHref = (nextPage: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (!v || k === "page") continue;
      q.set(k, v);
    }
    q.set("page", String(nextPage));
    return `/dashboard/offerings/reports?${q.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Offering reports</h1>
          <p className="text-sm font-medium text-foreground">{label}</p>
        </div>
        <ButtonLink href="/dashboard/offerings">Back to offerings</ButtonLink>
      </div>

      <Suspense fallback={<div className="h-20 animate-pulse rounded-md bg-muted" />}>
        <OfferingReportToolbar />
      </Suspense>

      {showAttendanceSummary ? (
        <div className="space-y-3 rounded-md border border-border p-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Mahudhurio (Attendance)</h2>
            <p className="text-sm text-muted-foreground">
              Sunday service batches 1 &amp; 2 — {label}
            </p>
          </div>
          <div className="max-h-[40vh] overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Church week</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Wanaume</TableHead>
                  <TableHead className="text-right">Wanawake</TableHead>
                  <TableHead className="text-right">Watoto (Shule ya Jumapili)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No attendance recorded for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {attendanceRows.map((row, idx) => (
                      <TableRow key={`${row.weekLabel}-${row.batchLabel}-${idx}`}>
                        <TableCell>{row.weekLabel}</TableCell>
                        <TableCell>{row.batchLabel}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.men != null ? row.men.toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.women != null ? row.women.toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.children != null ? row.children.toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>{row.status.replaceAll("_", " ")}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-semibold">Total</TableCell>
                      <TableCell>—</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {attendanceTotals.men.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {attendanceTotals.women.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {attendanceTotals.children.toLocaleString()}
                      </TableCell>
                      <TableCell>—</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      <div className="max-h-[70vh] overflow-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Offering #</TableHead>
              <TableHead className="text-right">Ahadi (pledged)</TableHead>
              <TableHead className="text-right">Ahadi (given)</TableHead>
              <TableHead className="text-right">Jengo (pledged)</TableHead>
              <TableHead className="text-right">Jengo (given)</TableHead>
              <TableHead className="text-right">Dayosisi (pledged)</TableHead>
              <TableHead className="text-right">Dayosisi (given)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(members ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No members.
                </TableCell>
              </TableRow>
            ) : (
              pagedMembers.map((m) => {
                const details =
                  m.member_details && typeof m.member_details === "object"
                    ? (m.member_details as Record<string, unknown>)
                    : null;
                const uid = m.user_id ? String(m.user_id) : "";
                const s = sums.get(m.id)!;
                const href = uid ? `/dashboard/members/${uid}/offerings` : null;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      {href ? (
                        <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
                          {nameByUser.get(uid) ?? "—"}
                        </Link>
                      ) : (
                        (nameByUser.get(uid) ?? "—")
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{m.offering_number ?? "—"}</TableCell>
                    <TableCell className="text-right">{pledgeText(details, "pledge_1")}</TableCell>
                    <TableCell className="text-right">{formatAmountTZS(s.ahadi)}</TableCell>
                    <TableCell className="text-right">{pledgeText(details, "pledge_2")}</TableCell>
                    <TableCell className="text-right">{formatAmountTZS(s.jengo)}</TableCell>
                    <TableCell className="text-right">{pledgeText(details, "pledge_3")}</TableCell>
                    <TableCell className="text-right">{formatAmountTZS(s.maendeleo)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {safePage} of {totalPages}
        </span>
        <div className="flex items-center gap-3">
          {safePage > 1 ? (
            <ButtonLink href={pageHref(safePage - 1)} variant="outline" size="sm">
              Previous
            </ButtonLink>
          ) : (
            <span className="opacity-50">Previous</span>
          )}
          {safePage < totalPages ? (
            <ButtonLink href={pageHref(safePage + 1)} variant="outline" size="sm">
              Next
            </ButtonLink>
          ) : (
            <span className="opacity-50">Next</span>
          )}
        </div>
      </div>
    </div>
  );
}
