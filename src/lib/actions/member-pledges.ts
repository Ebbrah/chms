"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyOrgId, getMyRoles } from "@/lib/auth/session";
import {
  canEditPendingOfferings,
  canRecordMidWeekOfferings,
  canRecordWeeklyOfferings,
} from "@/lib/auth/permissions";
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

/** Build exact-match candidates (handles leading zeros like 123 → 0123). */
function offeringNumberLookupVariants(raw: string): string[] {
  const q = sanitizeOfferingSearch(raw);
  if (!q) return [];

  const variants = new Set<string>([q]);
  const digits = q.replace(/[^0-9]/g, "");
  const isNumericQuery = digits.length > 0 && digits === q.replace(/\s/g, "");
  if (isNumericQuery) {
    variants.add(digits);
    const maxPad = Math.max(8, digits.length + 2);
    for (let len = digits.length; len <= maxPad; len += 1) {
      variants.add(digits.padStart(len, "0"));
    }
  }
  return Array.from(variants);
}

type MemberLookupRow = {
  id: string;
  offering_number: string | null;
  user_id: string | null;
  phone: string | null;
  household_id: string | null;
  member_details: unknown;
};

type SeedLookupRow = {
  offering_number: string | null;
  full_name: string | null;
  phone: string | null;
  raw: unknown;
};

async function findMemberByOfferingVariants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  variants: string[],
): Promise<MemberLookupRow | null> {
  for (const variant of variants) {
    const { data, error } = await supabase
      .from("members")
      .select("id, offering_number, user_id, phone, household_id, member_details")
      .eq("org_id", orgId)
      .ilike("offering_number", variant)
      .maybeSingle();
    if (error) return null;
    if (data?.id) return data as MemberLookupRow;
  }
  return null;
}

async function findSeedByOfferingVariants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  variants: string[],
): Promise<SeedLookupRow | null> {
  for (const variant of variants) {
    const { data, error } = await supabase
      .from("member_seeds")
      .select("offering_number, full_name, phone, raw")
      .eq("org_id", orgId)
      .ilike("offering_number", variant)
      .maybeSingle();
    if (error) return null;
    if (data?.offering_number) return data as SeedLookupRow;
  }
  return null;
}

export type OfferingNumberLookupRow = {
  memberId: string | null;
  offeringNumber: string;
  fullName: string;
  phone: string;
  jumuiyaName: string;
  source: "member" | "seed";
};

function fullNameFromMemberDetails(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  const raw = (details as Record<string, unknown>).full_name;
  return typeof raw === "string" ? raw.trim() : "";
}

function jumuiyaFromSeedRaw(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const obj = raw as Record<string, unknown>;
  for (const key of ["jumuiya", "Jumuiya", "household", "Household"]) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Exact offering-number match (same as weekly envelope save) — no fuzzy pick list. */
export async function lookupMemberByExactOfferingNumber(offeringNumber: string) {
  const supabase = await createClient();
  const orgId = await getMyOrgId();
  if (!orgId) return { error: "No organization" } as const;

  const q = sanitizeOfferingSearch(offeringNumber);
  if (!q) return { found: false as const };

  const variants = offeringNumberLookupVariants(q);
  const member = await findMemberByOfferingVariants(supabase, orgId, variants);

  if (member?.id) {
    let fullName = fullNameFromMemberDetails(member.member_details);
    let phone = String(member.phone ?? "").trim();

    if (member.user_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", member.user_id)
        .maybeSingle();
      const profileName = String(prof?.full_name ?? "").trim();
      const profilePhone = String(prof?.phone ?? "").trim();
      if (profileName) fullName = profileName;
      if (profilePhone) phone = profilePhone;
    }

    let jumuiyaName = "";
    if (member.household_id) {
      const { data: household } = await supabase
        .from("households")
        .select("name")
        .eq("id", String(member.household_id))
        .maybeSingle();
      jumuiyaName = String(household?.name ?? "").trim();
    }

    const row: OfferingNumberLookupRow = {
      memberId: String(member.id),
      offeringNumber: String(member.offering_number ?? q).trim(),
      fullName: fullName || "—",
      phone,
      jumuiyaName,
      source: "member",
    };
    return { found: true as const, row };
  }

  const seed = await findSeedByOfferingVariants(supabase, orgId, variants);

  if (seed?.offering_number) {
    const row: OfferingNumberLookupRow = {
      memberId: null,
      offeringNumber: String(seed.offering_number).trim(),
      fullName: String(seed.full_name ?? "").trim() || "—",
      phone: String(seed.phone ?? "").trim(),
      jumuiyaName: jumuiyaFromSeedRaw(seed.raw),
      source: "seed",
    };
    return { found: true as const, row };
  }

  return { found: false as const };
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

export async function updateMemberOtherPledgeLine(input: {
  pledgeId: string;
  field: "amount" | "paid_amount";
  amount: number;
}) {
  const roles = await getMyRoles();
  if (!canEditPendingOfferings(roles)) {
    return { error: "You cannot edit other pledges" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
  const orgId = profile?.org_id;
  if (!orgId) return { error: "No organization" };

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { error: "Invalid amount" };
  }

  const { data: row, error } = await supabase
    .from("member_other_pledges")
    .select("id, org_id, batch_id, amount, paid_amount")
    .eq("id", input.pledgeId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error || !row) return { error: "Pledge not found" };
  if (!row.batch_id) return { error: "Pledge is not attached to a weekly batch" };

  const { data: batch, error: bErr } = await supabase
    .from("offering_week_batches")
    .select("id, status")
    .eq("id", row.batch_id)
    .eq("org_id", orgId)
    .single();
  if (bErr || !batch) return { error: "Batch not found" };
  if (!["pending_authorization", "rejected"].includes(batch.status)) {
    return { error: "This pledge can only be edited before authorization or after rejection" };
  }

  const nextAmount = input.field === "amount" ? amount : Number(row.amount);
  const nextPaid = input.field === "paid_amount" ? amount : Number(row.paid_amount ?? 0);
  if (nextPaid > nextAmount) {
    return { error: "Paid amount cannot exceed pledge amount" };
  }

  const { error: upErr } = await supabase
    .from("member_other_pledges")
    .update(input.field === "amount" ? { amount: nextAmount } : { paid_amount: nextPaid })
    .eq("id", row.id)
    .eq("org_id", orgId);
  if (upErr) return { error: upErr.message };

  revalidatePath("/dashboard/offerings");
  revalidatePath(`/dashboard/offerings/batches/${row.batch_id}`);
  return { ok: true };
}
