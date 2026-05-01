import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmountTZS } from "@/lib/format/amount";
import { offeringBatchSlotLabel } from "@/lib/offering/weekly";

export default async function OfferingBatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ envelopePage?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const parsedEnvelopePage = Number(sp.envelopePage ?? "1");
  const envelopePage =
    Number.isFinite(parsedEnvelopePage) && parsedEnvelopePage > 0
      ? Math.floor(parsedEnvelopePage)
      : 1;
  const envelopePageSize = 30;
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("offering_week_batches")
    .select("id, org_id, week_start_date, week_end_date, status, created_at, affected_rows, batch_slot")
    .eq("id", id)
    .single();
  if (!batch) notFound();

  const { data: weekBatches } = await supabase
    .from("offering_week_batches")
    .select("id, batch_slot")
    .eq("org_id", batch.org_id)
    .eq("week_start_date", batch.week_start_date)
    .eq("week_end_date", batch.week_end_date);

  const batchList = weekBatches ?? [];
  const weekBatchIds = batchList.map((b) => String(b.id));
  const idToSlot = new Map(
    batchList.map((b) => [String(b.id), Number((b as { batch_slot?: number }).batch_slot ?? 1)]),
  );

  const totalByBatchSlot = new Map<number, number>();

  if (weekBatchIds.length > 0) {
    const { data: oRows } = await supabase.from("offerings").select("batch_id, amount").in("batch_id", weekBatchIds);
    for (const o of oRows ?? []) {
      const slot = idToSlot.get(String(o.batch_id)) ?? 1;
      const amt = Number(o.amount);
      if (!Number.isFinite(amt)) continue;
      totalByBatchSlot.set(slot, (totalByBatchSlot.get(slot) ?? 0) + amt);
    }
  }

  if (weekBatchIds.length > 0) {
    const { data: pRows } = await supabase
      .from("member_other_pledges")
      .select("batch_id, amount")
      .in("batch_id", weekBatchIds);
    for (const p of pRows ?? []) {
      const bid = p.batch_id != null ? String(p.batch_id) : "";
      if (!bid) continue;
      const slot = idToSlot.get(bid);
      if (slot === undefined) continue;
      const amt = Number(p.amount);
      if (!Number.isFinite(amt)) continue;
      totalByBatchSlot.set(slot, (totalByBatchSlot.get(slot) ?? 0) + amt);
    }
  }

  const weekBatchTotals = Array.from(totalByBatchSlot.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([batchSeq, total]) => ({ batchSeq, total }));
  const grandTotalWeek = weekBatchTotals.reduce((s, r) => s + r.total, 0);

  const { data: otherPledgeRowsRaw } = await supabase
    .from("member_other_pledges")
    .select("pledge_date, title, amount, paid_amount, member_id, full_name, phone_number, jumuiya_name")
    .eq("batch_id", id)
    .order("pledge_date", { ascending: false });

  const pledgeMemberIds = Array.from(
    new Set((otherPledgeRowsRaw ?? []).map((r) => String(r.member_id ?? "")).filter(Boolean)),
  );
  const { data: pledgeMembers } = pledgeMemberIds.length
    ? await supabase.from("members").select("id, offering_number").in("id", pledgeMemberIds)
    : { data: [] };
  const offeringNumByMemberId = new Map((pledgeMembers ?? []).map((m) => [String(m.id), String(m.offering_number ?? "—")]));

  const { data: rows } = await supabase
    .from("offerings")
    .select("id, amount, received_at, member_id, offering_number_snapshot, offering_types(name), members(offering_number)")
    .eq("batch_id", id)
    .order("received_at", { ascending: false })
    // Large batches can exceed 500 rows; keep this high so latest inserts still render.
    .limit(5000);

  const grouped = new Map<
    string,
    {
      key: string;
      date: string;
      offeringNumber: string;
      ahadi: number;
      jengo: number;
      dayosisi: number;
    }
  >();
  const collectiveGrouped = new Map<string, { name: string; amount: number }>();

  for (const o of rows ?? []) {
    const ot = o.offering_types as { name?: string } | { name?: string }[] | null;
    const offeringTypeName = String(Array.isArray(ot) ? ot[0]?.name ?? "" : ot?.name ?? "");
    const typeName = offeringTypeName.toLowerCase();
      const amount = Number(o.amount);
    if (!Number.isFinite(amount)) continue;

    if (!o.member_id) {
      const snapshot = String(
        (o as { offering_number_snapshot?: string }).offering_number_snapshot ?? "",
      ).trim();
      if (snapshot) {
        const date = o.received_at ? new Date(o.received_at as string).toLocaleString() : "—";
        const key = `unregistered::${snapshot.toLowerCase()}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            key,
            date,
            offeringNumber: snapshot,
            ahadi: 0,
            jengo: 0,
            dayosisi: 0,
          });
        }
        const target = grouped.get(key)!;
        if (typeName.includes("ahadi")) target.ahadi += amount;
        else if (typeName.includes("jengo")) target.jengo += amount;
        else if (typeName.includes("maendeleo") || typeName.includes("dayosisi")) target.dayosisi += amount;
        continue;
      }
      const key = offeringTypeName || "Other";
      if (!collectiveGrouped.has(key)) {
        collectiveGrouped.set(key, { name: key, amount: 0 });
      }
      collectiveGrouped.get(key)!.amount += amount;
      continue;
    }

    const mem = o.members as { offering_number?: string } | { offering_number?: string }[] | null;
    const offeringNumber = String(
      (Array.isArray(mem) ? mem[0]?.offering_number : mem?.offering_number) ?? "—",
    );
    const date = o.received_at ? new Date(o.received_at as string).toLocaleString() : "—";
    const key = `${String(o.member_id ?? "unknown")}::${offeringNumber}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        date,
        offeringNumber,
        ahadi: 0,
        jengo: 0,
        dayosisi: 0,
      });
    }

    const target = grouped.get(key)!;
    if (typeName.includes("ahadi")) target.ahadi += amount;
    else if (typeName.includes("jengo")) target.jengo += amount;
    else if (typeName.includes("maendeleo") || typeName.includes("dayosisi")) target.dayosisi += amount;
  }

  const pivotedRows = Array.from(grouped.values());
  const collectiveRows = Array.from(collectiveGrouped.values());
  const collectiveTotal = collectiveRows.reduce((sum, r) => sum + r.amount, 0);
  const pledgeTotals = pivotedRows.reduce(
    (acc, r) => {
      acc.ahadi += r.ahadi;
      acc.jengo += r.jengo;
      acc.dayosisi += r.dayosisi;
      return acc;
    },
    { ahadi: 0, jengo: 0, dayosisi: 0 },
  );
  const totalEnvelopePages = Math.max(1, Math.ceil(pivotedRows.length / envelopePageSize));
  const safeEnvelopePage = Math.min(envelopePage, totalEnvelopePages);
  const envelopeFrom = (safeEnvelopePage - 1) * envelopePageSize;
  const envelopeTo = envelopeFrom + envelopePageSize;
  const pagedPivotedRows = pivotedRows.slice(envelopeFrom, envelopeTo);
  const envelopePageHref = (nextPage: number) =>
    `/dashboard/offerings/batches/${id}?envelopePage=${nextPage}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Batch details</h1>
        </div>
        <Link
          href="/dashboard/offerings"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Back to offerings
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Weekly offering totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {weekBatchTotals.length === 0 ? (
            <p className="text-muted-foreground">Hakuna matoleo yaliyorekodiwa kwa wiki hii bado.</p>
          ) : (
            weekBatchTotals.map(({ batchSeq, total }) => (
              <div
                key={batchSeq}
                className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"
              >
                <span className="font-medium text-foreground">
                  Batch {batchSeq} ({offeringBatchSlotLabel(batchSeq)})
                </span>
                <span className="font-semibold tabular-nums">{formatAmountTZS(total)}</span>
              </div>
            ))
          )}
          <div className="border-t pt-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <span className="font-semibold">Grand total for week</span>
              <span className="text-lg font-semibold tabular-nums">{formatAmountTZS(grandTotalWeek)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Matoleo Mengineyo</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {collectiveRows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No collective offerings in this batch.
            </div>
          ) : (
            <>
              <div className="max-h-[18rem] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Offering</TableHead>
                      <TableHead className="text-right">Amount (TZS)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collectiveRows.map((r) => (
                      <TableRow key={r.name}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell className="text-right">{formatAmountTZS(r.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="border-t px-4 py-3 text-right text-sm font-semibold">
                Total: {formatAmountTZS(collectiveTotal)}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ahadi nyingine</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(otherPledgeRowsRaw ?? []).length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Hakuna ahadi nyingine kwenye batch hii.
            </div>
          ) : (
            <div className="max-h-[18rem] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarehe</TableHead>
                    <TableHead>Namba</TableHead>
                    <TableHead>Jina</TableHead>
                    <TableHead>Simu</TableHead>
                    <TableHead>Jumuiya</TableHead>
                    <TableHead>Jina la ahadi</TableHead>
                    <TableHead className="text-right">Kiasi (TZS)</TableHead>
                    <TableHead className="text-right">Paid (TZS)</TableHead>
                    <TableHead className="text-right">Balance (TZS)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(otherPledgeRowsRaw ?? []).map((r, idx) => (
                    <TableRow key={`${String(r.pledge_date)}-${idx}`}>
                      <TableCell>{String(r.pledge_date)}</TableCell>
                      <TableCell className="font-mono">
                        {offeringNumByMemberId.get(String(r.member_id)) ?? "—"}
                      </TableCell>
                      <TableCell>{String((r as { full_name?: string | null }).full_name ?? "—")}</TableCell>
                      <TableCell>{String((r as { phone_number?: string | null }).phone_number ?? "—")}</TableCell>
                      <TableCell>{String((r as { jumuiya_name?: string | null }).jumuiya_name ?? "—")}</TableCell>
                      <TableCell>{String(r.title ?? "")}</TableCell>
                      <TableCell className="text-right">{formatAmountTZS(Number(r.amount ?? 0))}</TableCell>
                      <TableCell className="text-right">
                        {formatAmountTZS(Number((r as { paid_amount?: number | null }).paid_amount ?? 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatAmountTZS(
                          Number(r.amount ?? 0) - Number((r as { paid_amount?: number | null }).paid_amount ?? 0),
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Matoleo ya Kwenye Bahasha</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[65rem] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Offering #</TableHead>
                  <TableHead className="text-right">Ahadi (TZS)</TableHead>
                  <TableHead className="text-right">Jengo (TZS)</TableHead>
                  <TableHead className="text-right">Dayosisi (TZS)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedPivotedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No lines in this batch.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedPivotedRows.map((row) => {
                    return (
                      <TableRow key={row.key}>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.offeringNumber}</TableCell>
                        <TableCell className="text-right">
                          {row.ahadi > 0 ? formatAmountTZS(row.ahadi) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.jengo > 0 ? formatAmountTZS(row.jengo) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.dayosisi > 0 ? formatAmountTZS(row.dayosisi) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
                {pivotedRows.length > 0 ? (
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatAmountTZS(pledgeTotals.ahadi)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatAmountTZS(pledgeTotals.jengo)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatAmountTZS(pledgeTotals.dayosisi)}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              Page {safeEnvelopePage} of {totalEnvelopePages}
            </span>
            <div className="flex items-center gap-3">
              {safeEnvelopePage > 1 ? (
                <Link href={envelopePageHref(safeEnvelopePage - 1)} className="text-primary hover:underline">
                  Previous
                </Link>
              ) : (
                <span className="opacity-50">Previous</span>
              )}
              {safeEnvelopePage < totalEnvelopePages ? (
                <Link href={envelopePageHref(safeEnvelopePage + 1)} className="text-primary hover:underline">
                  Next
                </Link>
              ) : (
                <span className="opacity-50">Next</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
