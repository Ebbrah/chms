"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canFinance } from "@/lib/auth/permissions";
import { getMyRoles } from "@/lib/auth/session";

export type MemberSeedInput = {
  offering_number: string;
  full_name: string;
  gender?: string | null;
  phone?: string | null;
  pledge_ahadi?: number | null;
  pledge_jengo?: number | null;
  pledge_dayosisi?: number | null;
  raw?: Record<string, unknown> | null;
};

function cleanText(v: unknown) {
  return String(v ?? "").trim();
}
function normalizeName(v: unknown) {
  return cleanText(v).replace(/\s+/g, " ");
}
function cleanPhone(v: unknown) {
  const t = cleanText(v);
  return t || null;
}
function cleanNumber(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

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

async function linkUnassignedOfferingsByNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  memberId: string,
  offeringNumber: string | null,
) {
  const normalizedOfferingNumber = String(offeringNumber ?? "").trim();
  if (!normalizedOfferingNumber) return;

  const { error } = await supabase
    .from("offerings")
    .update({ member_id: memberId })
    .eq("org_id", orgId)
    .is("member_id", null)
    .ilike("offering_number_snapshot", normalizedOfferingNumber);

  if (error) {
    throw new Error(`Could not auto-link prior offerings: ${error.message}`);
  }
}

function dedupeMemberSeeds(inputs: MemberSeedInput[]) {
  const byOfferingNumber = new Map<string, MemberSeedInput>();
  let duplicateCount = 0;

  for (const input of inputs ?? []) {
    const offeringNumber = cleanText(input.offering_number);
    const fullName = cleanText(input.full_name);
    if (!offeringNumber || !fullName) continue;

    if (byOfferingNumber.has(offeringNumber)) duplicateCount += 1;

    // Keep the last occurrence so later spreadsheet rows win.
    byOfferingNumber.set(offeringNumber, {
      ...input,
      offering_number: offeringNumber,
      full_name: fullName,
    });
  }

  return {
    rows: Array.from(byOfferingNumber.values()),
    duplicateCount,
  };
}

export async function upsertMemberSeeds(
  inputs: MemberSeedInput[],
  options?: { replaceExisting?: boolean },
) {
  const roles = await getMyRoles();
  if (!canFinance(roles)) return { error: "Unauthorized" };

  const { supabase, orgId } = await orgContext();
  if (!orgId) return { error: "Unauthorized" };

  const { rows: dedupedInputs, duplicateCount } = dedupeMemberSeeds(inputs);

  const rows = dedupedInputs
    .map((r) => {
      return {
        org_id: orgId,
        offering_number: r.offering_number,
        full_name: r.full_name,
        gender: cleanText(r.gender) || null,
        phone: cleanPhone(r.phone),
        pledge_ahadi: cleanNumber(r.pledge_ahadi),
        pledge_jengo: cleanNumber(r.pledge_jengo),
        pledge_dayosisi: cleanNumber(r.pledge_dayosisi),
        raw: (r.raw ?? {}) as Record<string, unknown>,
      };
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  if (!rows.length) return { error: "No valid rows found" };

  if (options?.replaceExisting) {
    const { error: deleteError } = await supabase.from("member_seeds").delete().eq("org_id", orgId);
    if (deleteError) return { error: deleteError.message };
  }

  const { error } = await supabase.from("member_seeds").upsert(rows, {
    onConflict: "org_id,offering_number",
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/members/import");
  revalidatePath("/dashboard/members/unregistered-seeds");
  return { ok: true, count: rows.length, duplicateCount };
}

export async function applySeedToUserMember(userId: string) {
  const roles = await getMyRoles();
  if (!canFinance(roles)) return { error: "Unauthorized" };

  const { supabase, orgId } = await orgContext();
  if (!orgId) return { error: "Unauthorized" };
  if (!userId) return { error: "Missing user id" };

  const { data: member } = await supabase
    .from("members")
    .select("id, org_id, user_id, offering_number, phone, member_details")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!member?.id) return { error: "Member not found" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  const oldDetails =
    member.member_details && typeof member.member_details === "object"
      ? (member.member_details as Record<string, unknown>)
      : {};

  const currentOfferingNumber = cleanText(member.offering_number);
  const detailFullName = normalizeName(oldDetails.full_name);
  const profileFullName = normalizeName(profile?.full_name);
  const lookupFullName = detailFullName || profileFullName;

  // 1) Prefer exact offering number match (most reliable key).
  let seedByOffering: {
    offering_number: string;
    full_name: string;
    gender: string | null;
    phone: string | null;
    pledge_ahadi: number | null;
    pledge_jengo: number | null;
    pledge_dayosisi: number | null;
    raw: Record<string, unknown> | null;
  } | null = null;
  if (currentOfferingNumber) {
    const { data: byOffering, error: byOfferingError } = await supabase
      .from("member_seeds")
      .select("*")
      .eq("org_id", orgId)
      .eq("offering_number", currentOfferingNumber)
      .maybeSingle();
    if (byOfferingError) return { error: byOfferingError.message };
    seedByOffering = byOffering as typeof seedByOffering;
  }

  // 2) Fallback to full-name match only when offering-number match is missing.
  let seedByName: {
    offering_number: string;
    full_name: string;
    gender: string | null;
    phone: string | null;
    pledge_ahadi: number | null;
    pledge_jengo: number | null;
    pledge_dayosisi: number | null;
    raw: Record<string, unknown> | null;
  } | null = null;
  if (!seedByOffering && lookupFullName) {
    const { data: seedCandidates, error: seedError } = await supabase
      .from("member_seeds")
      .select("*")
      .eq("org_id", orgId)
      .ilike("full_name", lookupFullName);
    if (seedError) return { error: seedError.message };
    const exactCaseInsensitive = (seedCandidates ?? []).filter(
      (seed) => normalizeName(seed.full_name).toLowerCase() === lookupFullName.toLowerCase(),
    );
    if (exactCaseInsensitive.length > 1) {
      return { error: "Multiple seed rows found for this full name. Please make names unique in upload." };
    }
    seedByName = (exactCaseInsensitive[0] ?? null) as typeof seedByName;
  }

  const seed = (seedByOffering ?? seedByName) as
    | {
        offering_number: string;
        full_name: string;
        gender: string | null;
        phone: string | null;
        pledge_ahadi: number | null;
        pledge_jengo: number | null;
        pledge_dayosisi: number | null;
        raw: Record<string, unknown> | null;
      }
    | null;
  if (!seed) {
    return {
      error:
        "No seed data found for this member (checked by offering number first, then full name).",
    };
  }

  const seedDisplayName = cleanText(seed.full_name);
  const mergedDetails = {
    ...(seed.raw ?? {}),
    ...oldDetails,
    // Prefer seed list spelling (complete name) over signup typos / single names.
    full_name: seedDisplayName || String(oldDetails.full_name ?? "").trim() || lookupFullName,
    gender: oldDetails.gender ?? seed.gender ?? "",
    // Load button should actively refresh pledge values from imported seed.
    pledge_1: seed.pledge_ahadi != null ? String(seed.pledge_ahadi) : "",
    pledge_2: seed.pledge_jengo != null ? String(seed.pledge_jengo) : "",
    pledge_3: seed.pledge_dayosisi != null ? String(seed.pledge_dayosisi) : "",
  };

  const { error } = await supabase
    .from("members")
    .update({
      offering_number: seed.offering_number ?? null,
      phone: seed.phone ?? null,
      member_details: mergedDetails,
    })
    .eq("id", member.id);

  if (error) return { error: error.message };

  if (seedDisplayName) {
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ full_name: seedDisplayName })
      .eq("id", userId)
      .eq("org_id", orgId);
    if (profileErr) return { error: profileErr.message };
  }
  try {
    await linkUnassignedOfferingsByNumber(
      supabase,
      orgId,
      String(member.id),
      seed.offering_number ?? null,
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not auto-link prior offerings" };
  }

  revalidatePath("/dashboard/members");
  revalidatePath(`/dashboard/members/${userId}`);
  revalidatePath(`/dashboard/members/${userId}/details`);
  revalidatePath("/dashboard");
  return { ok: true };
}

