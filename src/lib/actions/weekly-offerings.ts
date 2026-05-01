"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertBalancedLines } from "@/lib/finance/ledger";
import { getMyRoles } from "@/lib/auth/session";
import {
  canApproveOfferingBatch,
  canAuthorizeOfferingBatch,
  canEditPendingOfferings,
  canRecordMidWeekOfferings,
  canRecordWeeklyOfferings,
} from "@/lib/auth/permissions";
import {
  OFFERING_BATCH_SLOT_FIRST_SERVICE,
  OFFERING_BATCH_SLOT_MIDWEEK,
  OFFERING_BATCH_SLOT_SECOND_SERVICE,
  WEEKLY_OFFERING_ROW_LIMIT,
  WEEKLY_OFFERING_TYPE_NAMES,
  type WeeklyOfferingRowInput,
  formatDateISO,
  getWeekRangeContainingDate,
  receivedAtFromUserPickedDate,
} from "@/lib/offering/weekly";

async function orgContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, orgId: null as string | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  return { supabase, user, orgId: profile?.org_id ?? null };
}

async function ensureOfferingTypes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const name of WEEKLY_OFFERING_TYPE_NAMES) {
    const { data: existing } = await supabase
      .from("offering_types")
      .select("id,name")
      .eq("org_id", orgId)
      .eq("name", name)
      .maybeSingle();
    if (existing?.id) {
      map.set(name, existing.id);
      continue;
    }
    const { data: created, error } = await supabase
      .from("offering_types")
      .insert({ org_id: orgId, name })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not create offering type");
    map.set(name, created.id);
  }
  return map;
}

async function hasApprovedBatchForWeekSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  startStr: string,
  endStr: string,
  slot: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("offering_week_batches")
    .select("id")
    .eq("org_id", orgId)
    .eq("week_start_date", startStr)
    .eq("week_end_date", endStr)
    .eq("batch_slot", slot)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();
  if (error) return false;
  return !!data?.id;
}

async function countWeekBatchesForSlot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  startStr: string,
  endStr: string,
  slot: number,
): Promise<number> {
  const { count, error } = await supabase
    .from("offering_week_batches")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("week_start_date", startStr)
    .eq("week_end_date", endStr)
    .eq("batch_slot", slot);
  if (error) return 0;
  return Number(count ?? 0);
}

/**
 * Resolves the editable `offering_week_batches` row for a church week.
 *
 * - When `batchSlot` is set (1 = first Sunday service, 2 = second Sunday, 3 = mid-week):
 *   reuse an open batch for that slot, or create a new batch with that `batch_slot`.
 *   Sequencing: batch 2 opens only after some batch 1 for the week is **approved**; batch 3 opens
 *   after batch 2 is approved if any batch-2 row exists for the week, otherwise after batch 1 is
 *   approved (single-Sunday churches that never create batch 2).
 * - When `batchSlot` is omitted (legacy): reuse any open batch for the week, else block if any
 *   batch is `authorized`, else create the next sequential `batch_slot`.
 */
async function getOrCreateEditableWeekBatch(args: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orgId: string;
  userId: string;
  startStr: string;
  endStr: string;
  batchSlot?: number;
}) {
  const { supabase, orgId, userId, startStr, endStr, batchSlot } = args;

  const explicitSlot =
    typeof batchSlot === "number" &&
    Number.isFinite(batchSlot) &&
    batchSlot >= 1 &&
    batchSlot <= 100;

  if (explicitSlot) {
    const slot = Math.floor(batchSlot as number);

    if (slot === OFFERING_BATCH_SLOT_SECOND_SERVICE) {
      const ok = await hasApprovedBatchForWeekSlot(supabase, orgId, startStr, endStr, OFFERING_BATCH_SLOT_FIRST_SERVICE);
      if (!ok) {
        return {
          error:
            "Approve batch 1 (first Sunday service) for this week before recording batch 2 (second Sunday service).",
          batchId: null as string | null,
        };
      }
    }

    if (slot === OFFERING_BATCH_SLOT_MIDWEEK) {
      const n2 = await countWeekBatchesForSlot(
        supabase,
        orgId,
        startStr,
        endStr,
        OFFERING_BATCH_SLOT_SECOND_SERVICE,
      );
      if (n2 > 0) {
        const ok2 = await hasApprovedBatchForWeekSlot(
          supabase,
          orgId,
          startStr,
          endStr,
          OFFERING_BATCH_SLOT_SECOND_SERVICE,
        );
        if (!ok2) {
          return {
            error:
              "Approve batch 2 (second Sunday service) for this week before recording batch 3 (mid-week).",
            batchId: null as string | null,
          };
        }
      } else {
        const ok1 = await hasApprovedBatchForWeekSlot(
          supabase,
          orgId,
          startStr,
          endStr,
          OFFERING_BATCH_SLOT_FIRST_SERVICE,
        );
        if (!ok1) {
          return {
            error:
              "Approve batch 1 (first Sunday service) for this week before recording batch 3 (mid-week).",
            batchId: null as string | null,
          };
        }
      }
    }

    const { data: openForSlot, error: openSlotErr } = await supabase
      .from("offering_week_batches")
      .select("id")
      .eq("org_id", orgId)
      .eq("week_start_date", startStr)
      .eq("week_end_date", endStr)
      .eq("batch_slot", slot)
      .in("status", ["pending_authorization", "rejected"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openSlotErr) {
      return { error: openSlotErr.message, batchId: null as string | null };
    }
    if (openForSlot?.id) {
      return { error: null as string | null, batchId: openForSlot.id };
    }

    const { data: authForSlot } = await supabase
      .from("offering_week_batches")
      .select("id")
      .eq("org_id", orgId)
      .eq("week_start_date", startStr)
      .eq("week_end_date", endStr)
      .eq("batch_slot", slot)
      .eq("status", "authorized")
      .limit(1)
      .maybeSingle();

    if (authForSlot?.id) {
      return {
        error:
          "This batch has a submission waiting for treasurer approval. You cannot add new entries until that batch is approved or rejected.",
        batchId: null as string | null,
      };
    }

    const { data: latestForSlot } = await supabase
      .from("offering_week_batches")
      .select("id,status")
      .eq("org_id", orgId)
      .eq("week_start_date", startStr)
      .eq("week_end_date", endStr)
      .eq("batch_slot", slot)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestForSlot?.status === "approved") {
      return {
        error: `Batch ${slot} for this week is already closed (approved). Choose another batch or another week.`,
        batchId: null as string | null,
      };
    }

    const { data: batch, error: batchErr } = await supabase
      .from("offering_week_batches")
      .insert({
        org_id: orgId,
        week_start_date: startStr,
        week_end_date: endStr,
        batch_slot: slot,
        status: "pending_authorization",
        recorded_by: userId,
      })
      .select("id")
      .single();

    if (batchErr || !batch) {
      return { error: batchErr?.message ?? "batch failed", batchId: null as string | null };
    }

    return { error: null as string | null, batchId: batch.id };
  }

  const { data: openBatch, error: openErr } = await supabase
    .from("offering_week_batches")
    .select("id")
    .eq("org_id", orgId)
    .eq("week_start_date", startStr)
    .eq("week_end_date", endStr)
    .in("status", ["pending_authorization", "rejected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openErr) {
    return { error: openErr.message, batchId: null as string | null };
  }

  if (openBatch?.id) {
    return { error: null as string | null, batchId: openBatch.id };
  }

  const { data: authorizedWaiting } = await supabase
    .from("offering_week_batches")
    .select("id")
    .eq("org_id", orgId)
    .eq("week_start_date", startStr)
    .eq("week_end_date", endStr)
    .eq("status", "authorized")
    .limit(1)
    .maybeSingle();

  if (authorizedWaiting?.id) {
    return {
      error:
        "A batch for this week is waiting for treasurer approval. You cannot add new offerings until that batch is approved or rejected.",
      batchId: null as string | null,
    };
  }

  const { count, error: countErr } = await supabase
    .from("offering_week_batches")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("week_start_date", startStr)
    .eq("week_end_date", endStr);

  if (countErr) {
    return { error: countErr.message, batchId: null as string | null };
  }

  const nextSeq = Number(count ?? 0) + 1;

  const { data: batch, error: batchErr } = await supabase
    .from("offering_week_batches")
    .insert({
      org_id: orgId,
      week_start_date: startStr,
      week_end_date: endStr,
      batch_slot: nextSeq,
      status: "pending_authorization",
      recorded_by: userId,
    })
    .select("id")
    .single();

  if (batchErr || !batch) {
    return { error: batchErr?.message ?? "batch failed", batchId: null as string | null };
  }

  return { error: null as string | null, batchId: batch.id };
}

/** Resolve/create the editable batch for the week containing `weekOfDateIso` (YYYY-MM-DD). */
export async function getOrCreateOfferingWeekBatchId(
  weekOfDateIso: string,
  options?: { batchSlot?: number },
): Promise<{ batchId: string } | { error: string }> {
  const roles = await getMyRoles();
  if (!canRecordMidWeekOfferings(roles) && !canRecordWeeklyOfferings(roles)) {
    return { error: "Unauthorized" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
  const orgId = profile?.org_id;
  if (!orgId) return { error: "No organization" };

  const weekDate = new Date(`${weekOfDateIso}T12:00:00`);
  if (Number.isNaN(weekDate.getTime())) return { error: "Invalid week date" };
  const { weekStart, weekEnd } = getWeekRangeContainingDate(weekDate);
  const startStr = formatDateISO(weekStart);
  const endStr = formatDateISO(weekEnd);

  const batch = await getOrCreateEditableWeekBatch({
    supabase,
    orgId,
    userId: user.id,
    startStr,
    endStr,
    batchSlot: options?.batchSlot,
  });
  if (batch.error || !batch.batchId) return { error: batch.error ?? "batch failed" };
  return { batchId: batch.batchId };
}

function parseAmount(v: unknown): number {
  if (v === "" || v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

/**
 * Save up to {@link WEEKLY_OFFERING_ROW_LIMIT} rows for a weekly batch; creates `offering_week_batches` + `offerings` rows.
 */
export async function saveWeeklyOfferingBatch(
  weekOfDateIso: string,
  rows: WeeklyOfferingRowInput[],
  batchSlot: number = OFFERING_BATCH_SLOT_FIRST_SERVICE,
) {
  const roles = await getMyRoles();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  const orgId = profile?.org_id;
  if (!orgId) return { error: "No organization" };

  if (!canRecordWeeklyOfferings(roles)) return { error: "Unauthorized" };

  const weekDate = new Date(weekOfDateIso + "T12:00:00");
  if (Number.isNaN(weekDate.getTime())) return { error: "Invalid week date" };

  const { weekStart, weekEnd } = getWeekRangeContainingDate(weekDate);
  const startStr = formatDateISO(weekStart);
  const endStr = formatDateISO(weekEnd);
  const receivedAt = receivedAtFromUserPickedDate(weekOfDateIso);

  const typeIds = await ensureOfferingTypes(supabase, orgId);

  const batch = await getOrCreateEditableWeekBatch({
    supabase,
    orgId,
    userId: user.id,
    startStr,
    endStr,
    batchSlot,
  });
  if (batch.error || !batch.batchId) return { error: batch.error ?? "batch failed" };
  const batchId = batch.batchId;

  const errors: string[] = [];
  let insertedLines = 0;
  const touchedMembers = new Set<string>();

  for (const raw of rows.slice(0, WEEKLY_OFFERING_ROW_LIMIT)) {
    const num = String(raw.offering_number ?? "").trim();
    if (!num) continue;
    const ahadi = parseAmount(raw.ahadi);
    const jengo = parseAmount(raw.jengo);
    const maendeleo = parseAmount(raw.maendeleo);
    if (ahadi + jengo + maendeleo <= 0) continue;

    const { data: member, error: mErr } = await supabase
      .from("members")
      .select("id")
      .eq("org_id", orgId)
      .ilike("offering_number", num)
      .maybeSingle();

    if (mErr) {
      errors.push(`Offering number "${num}" lookup failed`);
      continue;
    }

    const triple: { name: string; amount: number }[] = [
      { name: "Ahadi", amount: ahadi },
      { name: "Jengo", amount: jengo },
      { name: "Maendeleo ya Dayosisi", amount: maendeleo },
    ];

    for (const { name, amount } of triple) {
      if (amount <= 0) continue;
      const tid = typeIds.get(name);
      if (!tid) continue;
      const { error: insErr } = await supabase.from("offerings").insert({
        org_id: orgId,
        member_id: member?.id ?? null,
        offering_number_snapshot: num,
        offering_type_id: tid,
        amount,
        batch_id: batchId,
        budget_posted: false,
        recorded_by: user.id,
        received_at: receivedAt,
        notes: `Weekly ${startStr}–${endStr}`,
      });
      if (insErr) errors.push(`${num} ${name}: ${insErr.message}`);
      else insertedLines += 1;
    }
    if (member?.id) touchedMembers.add(member.id);
  }

  const { data: affectedMemberRows } = await supabase
    .from("offerings")
    .select("member_id")
    .eq("org_id", orgId)
    .eq("batch_id", batchId);
  const affectedRows = new Set(
    (affectedMemberRows ?? [])
      .map((r) => r.member_id)
      .filter((v) => typeof v === "string" && v.length > 0),
  ).size;

  await supabase
    .from("offering_week_batches")
    .update({
      status: "pending_authorization",
      affected_rows: affectedRows || touchedMembers.size,
      authorized_by: null,
      authorized_at: null,
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_at: null,
      rejected_reason: null,
    })
    .eq("id", batchId);

  revalidatePath("/dashboard/offerings");
  return {
    ok: true,
    batchId,
    inserted: insertedLines,
    affectedRows: affectedRows || touchedMembers.size,
    errors,
  };
}

export async function saveWeeklyCollectiveOffering(
  weekOfDateIso: string,
  offeringTypeId: string,
  amountInput: number,
  batchSlot: number = OFFERING_BATCH_SLOT_MIDWEEK,
) {
  const roles = await getMyRoles();
  if (!canRecordMidWeekOfferings(roles) && !canRecordWeeklyOfferings(roles)) {
    return { error: "Unauthorized" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  const orgId = profile?.org_id;
  if (!orgId) return { error: "No organization" };

  const amount = parseAmount(amountInput);
  if (amount <= 0) return { error: "Amount must be greater than zero" };

  const slot = Math.floor(batchSlot);
  if (!Number.isFinite(slot) || slot < 1 || slot > 100) {
    return { error: "Invalid batch" };
  }

  const weekDate = new Date(weekOfDateIso + "T12:00:00");
  if (Number.isNaN(weekDate.getTime())) return { error: "Invalid week date" };
  const { weekStart, weekEnd } = getWeekRangeContainingDate(weekDate);
  const startStr = formatDateISO(weekStart);
  const endStr = formatDateISO(weekEnd);
  const receivedAt = receivedAtFromUserPickedDate(weekOfDateIso);

  const { data: typeRow, error: typeErr } = await supabase
    .from("offering_types")
    .select("id,name")
    .eq("org_id", orgId)
    .eq("id", offeringTypeId)
    .single();
  if (typeErr || !typeRow) return { error: "Offering type not found" };
  if (WEEKLY_OFFERING_TYPE_NAMES.includes(typeRow.name as (typeof WEEKLY_OFFERING_TYPE_NAMES)[number])) {
    return { error: "Use the pledged offerings table for Ahadi, Jengo, and Dayosisi" };
  }

  const batch = await getOrCreateEditableWeekBatch({
    supabase,
    orgId,
    userId: user.id,
    startStr,
    endStr,
    batchSlot: slot,
  });
  if (batch.error || !batch.batchId) return { error: batch.error ?? "batch failed" };

  const { error: insErr } = await supabase.from("offerings").insert({
    org_id: orgId,
    member_id: null,
    offering_type_id: offeringTypeId,
    amount,
    batch_id: batch.batchId,
    budget_posted: false,
    recorded_by: user.id,
    received_at: receivedAt,
    notes: `Collective weekly ${startStr}–${endStr}`,
  });
  if (insErr) return { error: insErr.message };

  await supabase
    .from("offering_week_batches")
    .update({
      status: "pending_authorization",
      authorized_by: null,
      authorized_at: null,
      approved_by: null,
      approved_at: null,
      rejected_by: null,
      rejected_at: null,
      rejected_reason: null,
    })
    .eq("id", batch.batchId);

  revalidatePath("/dashboard/offerings");
  return { ok: true };
}

/**
 * Treasurer (or admin) posts approved weekly totals to the ledger (cash debit revenue credit).
 */
export async function approveOfferingWeekBatch(batchId: string) {
  const roles = await getMyRoles();
  if (!canApproveOfferingBatch(roles)) {
    return { error: "Only the treasurer can approve offering batches" };
  }

  const { supabase, user, orgId } = await orgContext();
  if (!user || !orgId) return { error: "Unauthorized" };

  const { data: batch, error: bErr } = await supabase
    .from("offering_week_batches")
    .select("id,status,org_id")
    .eq("id", batchId)
    .eq("org_id", orgId)
    .single();

  if (bErr || !batch) return { error: "Batch not found" };
  if (batch.status !== "authorized") return { error: "Batch must be authorized first" };

  const { data: lines, error: lErr } = await supabase
    .from("offerings")
    .select("id,amount,offering_type_id, budget_posted, offering_types(name)")
    .eq("batch_id", batchId)
    .eq("org_id", orgId);

  if (lErr) return { error: lErr.message };
  if (!lines?.length) return { error: "No offerings in this batch" };

  const unposted = lines.filter((o) => !o.budget_posted);
  if (!unposted.length) return { error: "Nothing to post" };

  let total = 0;
  for (const o of unposted) total += Number(o.amount);

  const { data: cash } = await supabase
    .from("accounts")
    .select("id")
    .eq("org_id", orgId)
    .eq("type", "asset")
    .eq("is_active", true)
    .order("code")
    .limit(1)
    .maybeSingle();

  const { data: revenue } = await supabase
    .from("accounts")
    .select("id")
    .eq("org_id", orgId)
    .eq("type", "revenue")
    .eq("is_active", true)
    .order("code")
    .limit(1)
    .maybeSingle();

  if (!cash?.id || !revenue?.id) {
    return { error: "Configure at least one asset (cash) and one revenue account first" };
  }

  const jl: { account_id: string; debit: number; credit: number; memo: string }[] = [
    { account_id: cash.id, debit: total, credit: 0, memo: "Cash — weekly offerings" },
    { account_id: revenue.id, debit: 0, credit: total, memo: "Offerings — weekly batch" },
  ];

  assertBalancedLines(jl.map((l) => ({ debit: l.debit, credit: l.credit })));

  const { data: entry, error: eErr } = await supabase
    .from("journal_entries")
    .insert({
      org_id: orgId,
      entry_date: new Date().toISOString().slice(0, 10),
      description: `Weekly offerings approved (${batchId.slice(0, 8)}…)`,
      source_type: "offering",
      source_id: batchId,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (eErr || !entry) return { error: eErr?.message ?? "Journal failed" };

  const { error: jlErr } = await supabase.from("journal_lines").insert(
    jl.map((l) => ({
      journal_entry_id: entry.id,
      account_id: l.account_id,
      debit: l.debit,
      credit: l.credit,
      memo: l.memo,
    })),
  );
  if (jlErr) return { error: jlErr.message };

  const ids = unposted.map((o) => o.id);
  const { error: upErr } = await supabase
    .from("offerings")
    .update({ budget_posted: true })
    .in("id", ids);

  if (upErr) return { error: upErr.message };

  const { error: batchUp } = await supabase
    .from("offering_week_batches")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      journal_entry_id: entry.id,
    })
    .eq("id", batchId);

  if (batchUp) return { error: batchUp.message };

  revalidatePath("/dashboard/offerings");
  revalidatePath("/dashboard/finance/budget");
  revalidatePath("/dashboard/finance/ledger");
  return { ok: true };
}

export async function authorizeOfferingWeekBatch(batchId: string) {
  const roles = await getMyRoles();
  if (!canAuthorizeOfferingBatch(roles)) {
    return { error: "Only committee head can authorize batches" };
  }
  const { supabase, user, orgId } = await orgContext();
  if (!user || !orgId) return { error: "Unauthorized" };

  const { data: batch, error } = await supabase
    .from("offering_week_batches")
    .select("id,status")
    .eq("id", batchId)
    .eq("org_id", orgId)
    .single();
  if (error || !batch) return { error: "Batch not found" };
  if (!["pending_authorization", "rejected"].includes(batch.status)) {
    return { error: "Only pending or rejected batches can be authorized" };
  }

  const { error: upErr } = await supabase
    .from("offering_week_batches")
    .update({
      status: "authorized",
      authorized_by: user.id,
      authorized_at: new Date().toISOString(),
      rejected_by: null,
      rejected_at: null,
      rejected_reason: null,
    })
    .eq("id", batchId);
  if (upErr) return { error: upErr.message };

  revalidatePath("/dashboard/offerings");
  return { ok: true };
}

export async function rejectOfferingWeekBatch(batchId: string, reason?: string) {
  const roles = await getMyRoles();
  if (!canApproveOfferingBatch(roles)) {
    return { error: "Only treasurer can reject batches" };
  }
  const { supabase, user, orgId } = await orgContext();
  if (!user || !orgId) return { error: "Unauthorized" };

  const { data: batch, error } = await supabase
    .from("offering_week_batches")
    .select("id,status")
    .eq("id", batchId)
    .eq("org_id", orgId)
    .single();
  if (error || !batch) return { error: "Batch not found" };
  if (batch.status !== "authorized") {
    return { error: "Only authorized batches can be rejected" };
  }

  const { error: upErr } = await supabase
    .from("offering_week_batches")
    .update({
      status: "rejected",
      rejected_by: user.id,
      rejected_at: new Date().toISOString(),
      rejected_reason: reason?.trim() || null,
    })
    .eq("id", batchId);
  if (upErr) return { error: upErr.message };

  revalidatePath("/dashboard/offerings");
  return { ok: true };
}

export async function updateOfferingLine(input: {
  offeringId: string;
  amount: number;
}) {
  const roles = await getMyRoles();
  if (!canEditPendingOfferings(roles)) {
    return { error: "You cannot edit offerings" };
  }
  const { supabase, orgId } = await orgContext();
  if (!orgId) return { error: "Unauthorized" };

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Invalid amount" };
  }

  const { data: row, error } = await supabase
    .from("offerings")
    .select("id,org_id,batch_id,budget_posted")
    .eq("id", input.offeringId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error || !row) return { error: "Offering not found" };
  if (row.budget_posted) return { error: "Offering already approved and posted" };
  if (!row.batch_id) return { error: "Offering is not attached to a weekly batch" };

  const { data: batch, error: bErr } = await supabase
    .from("offering_week_batches")
    .select("id,status")
    .eq("id", row.batch_id)
    .eq("org_id", orgId)
    .single();
  if (bErr || !batch) return { error: "Batch not found" };
  if (!["pending_authorization", "rejected"].includes(batch.status)) {
    return { error: "This offering can only be edited before authorization or after rejection" };
  }

  const { error: upErr } = await supabase
    .from("offerings")
    .update({ amount })
    .eq("id", row.id)
    .eq("org_id", orgId);
  if (upErr) return { error: upErr.message };

  revalidatePath("/dashboard/offerings");
  return { ok: true };
}
