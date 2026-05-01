"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyRoles } from "@/lib/auth/session";
import { canRecordMidWeekOfferings, canRecordWeeklyOfferings } from "@/lib/auth/permissions";
import { getOrCreateOfferingWeekBatchId } from "@/lib/actions/weekly-offerings";
import { OFFERING_BATCH_SLOT_MIDWEEK } from "@/lib/offering/weekly";

function parseBatchSlotFromForm(formData: FormData): number {
  const raw = String(formData.get("batch_slot") ?? "").trim();
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1 && n <= 3) return Math.floor(n);
  return OFFERING_BATCH_SLOT_MIDWEEK;
}

function readText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

/** Avoid ILIKE treating % and _ as wildcards for user input. */
function sanitizeOfferingSearch(raw: string) {
  return raw.trim().replace(/%/g, "").replace(/_/g, "");
}

export async function searchMembersByOfferingNumber(query: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" } as const;

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
  const orgId = profile?.org_id;
  if (!orgId) return { error: "No organization" } as const;

  const q = sanitizeOfferingSearch(query);
  if (!q) {
    return {
      rows: [] as {
        memberId: string | null;
        offeringNumber: string;
        fullName: string;
        phone: string;
        source: "member" | "seed";
      }[],
    };
  }

  const qCompact = q.replace(/\s+/g, "");
  const patterns = qCompact && qCompact !== q ? [q, qCompact] : [q];

  let rows: { id: string; offering_number: string | null; user_id: string | null }[] = [];
  for (const pat of patterns) {
    const res = await supabase
      .from("members")
      .select("id, offering_number, user_id")
      .eq("org_id", orgId)
      .ilike("offering_number", `%${pat}%`)
      .order("offering_number", { ascending: true })
      .limit(20);
    if (res.error) return { error: res.error.message } as const;
    rows = res.data ?? [];
    if (rows.length > 0) break;
  }

  const userIds = Array.from(new Set((rows ?? []).map((r) => String(r.user_id ?? "")).filter(Boolean)));
  const { data: profs, error: pErr } = userIds.length
    ? await supabase.from("profiles").select("id, full_name, phone").in("id", userIds)
    : { data: [], error: null };
  if (pErr) return { error: pErr.message } as const;

  const nameById = new Map((profs ?? []).map((p) => [String(p.id), String(p.full_name ?? "")]));
  const phoneById = new Map((profs ?? []).map((p) => [String(p.id), String(p.phone ?? "")]));

  let seedRows: { offering_number: string | null; full_name: string | null; phone: string | null }[] = [];
  for (const pat of patterns) {
    const res = await supabase
      .from("member_seeds")
      .select("offering_number, full_name, phone")
      .eq("org_id", orgId)
      .or(`offering_number.ilike.%${pat}%,full_name.ilike.%${pat}%,phone.ilike.%${pat}%`)
      .order("offering_number", { ascending: true })
      .limit(20);
    if (res.error) return { error: res.error.message } as const;
    seedRows = res.data ?? [];
    if (seedRows.length > 0) break;
  }

  const merged = new Map<
    string,
    {
      memberId: string | null;
      offeringNumber: string;
      fullName: string;
      phone: string;
      source: "member" | "seed";
    }
  >();

  for (const r of rows ?? []) {
    const offeringNumber = String(r.offering_number ?? "").trim();
    if (!offeringNumber) continue;
    const key = offeringNumber.toLowerCase();
    merged.set(key, {
      memberId: String(r.id),
      offeringNumber,
      fullName: nameById.get(String(r.user_id)) ?? "—",
      phone: phoneById.get(String(r.user_id)) ?? "",
      source: "member",
    });
  }

  for (const s of seedRows ?? []) {
    const offeringNumber = String(s.offering_number ?? "").trim();
    if (!offeringNumber) continue;
    const key = offeringNumber.toLowerCase();
    if (merged.has(key)) continue;
    merged.set(key, {
      memberId: null,
      offeringNumber,
      fullName: String(s.full_name ?? "").trim() || "—",
      phone: String(s.phone ?? "").trim(),
      source: "seed",
    });
  }

  return {
    rows: Array.from(merged.values()),
  };
}

export async function recordMemberOtherPledge(formData: FormData) {
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

  const memberId = readText(formData, "member_id");
  const pledgeDate = readText(formData, "pledge_date");
  const title = readText(formData, "title");
  const amountRaw = readText(formData, "amount");
  const paidAmountRaw = readText(formData, "paid_amount");
  const fullName = readText(formData, "full_name");
  const phoneNumber = readText(formData, "phone_number");
  const jumuiyaName = readText(formData, "jumuiya_name");
  if (!pledgeDate || !title) return { error: "Date and pledge name are required" };
  if (!memberId && !fullName) {
    return { error: "Select a registered member or enter full name for unregistered pledge." };
  }

  const amount = Number(amountRaw.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount < 0) return { error: "Invalid amount" };
  const paidAmount = paidAmountRaw ? Number(paidAmountRaw.replace(/,/g, "")) : 0;
  if (!Number.isFinite(paidAmount) || paidAmount < 0) return { error: "Invalid paid amount" };

  let normalizedMemberId: string | null = null;
  if (memberId) {
    const { data: member, error: mErr } = await supabase
      .from("members")
      .select("id")
      .eq("id", memberId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (mErr || !member) return { error: "Member not found" };
    normalizedMemberId = String(member.id);
  }

  const batchSlot = parseBatchSlotFromForm(formData);
  const batchRes = await getOrCreateOfferingWeekBatchId(pledgeDate, {
    batchSlot,
  });
  if ("error" in batchRes) return { error: batchRes.error };
  const batchId = batchRes.batchId;

  const { error: insErr } = await supabase.from("member_other_pledges").insert({
    org_id: orgId,
    member_id: normalizedMemberId,
    pledge_date: pledgeDate,
    title,
    amount,
    paid_amount: paidAmount,
    full_name: fullName || null,
    phone_number: phoneNumber || null,
    jumuiya_name: jumuiyaName || null,
    recorded_by: user.id,
    batch_id: batchId,
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
    .eq("id", batchId);

  revalidatePath("/dashboard/offerings");
  revalidatePath(`/dashboard/offerings/batches/${batchId}`);
  revalidatePath("/dashboard");
  return { ok: true, batchId };
}
