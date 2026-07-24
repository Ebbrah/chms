import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthDisplayIdentity } from "@/lib/auth/user-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { pickCanonicalMemberRow, type LinkedMemberRow } from "@/lib/members/load-linked-member";

export type ParishProfileRow = {
  id: string;
  org_id: string | null;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
};

const profileSelect = "id, org_id, full_name, email, phone";

export async function loadParishProfileRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<ParishProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(profileSelect)
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ParishProfileRow;
}

/** Profile org drives `current_org_id()` — prefer it over role-based resolution. */
export function resolveEffectiveParishOrgId(
  profileOrgId: string | null | undefined,
  resolvedOrgId: string | null,
): string | null {
  const profileOrg = String(profileOrgId ?? "").trim();
  if (profileOrg) return profileOrg;
  const resolved = String(resolvedOrgId ?? "").trim();
  return resolved || null;
}

/**
 * Align profiles.org_id with the member row before RLS-scoped reads.
 * When profile.org_id is missing or stale, member rows are invisible under members_select.
 */
export async function reconcileProfileOrgForMemberReads(
  supabase: SupabaseClient,
  userId: string,
  profileOrgId: string | null | undefined,
): Promise<string | null> {
  const profileOrg = String(profileOrgId ?? "").trim();

  if (profileOrg) {
    const { data: visibleMember } = await supabase
      .from("members")
      .select("org_id, offering_number, status, updated_at")
      .eq("user_id", userId)
      .eq("org_id", profileOrg)
      .order("updated_at", { ascending: false })
      .limit(5);
    const visible = pickCanonicalMemberRow(visibleMember ?? []);
    // Short-circuit when any member row is already readable under RLS (including pending approval).
    if (visible?.org_id) {
      return String(visible.org_id);
    }
  }

  try {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("members")
      .select("org_id, offering_number, status, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(5);

    const canonical = pickCanonicalMemberRow(rows ?? []);
    const memberOrg = String(canonical?.org_id ?? "").trim();
    if (!memberOrg) return profileOrg || null;

    if (memberOrg !== profileOrg) {
      await supabase.from("profiles").update({ org_id: memberOrg }).eq("id", userId);
    }
    return memberOrg;
  } catch {
    return profileOrg || null;
  }
}

/** Align profile.org_id with the linked member row so RLS reads succeed. */
export async function syncProfileOrgFromMember(
  supabase: SupabaseClient,
  userId: string,
  memberOrgId: string | null | undefined,
  profileOrgId: string | null | undefined,
): Promise<void> {
  const memberOrg = String(memberOrgId ?? "").trim();
  const profileOrg = String(profileOrgId ?? "").trim();
  if (!memberOrg || memberOrg === profileOrg) return;

  await supabase.from("profiles").update({ org_id: memberOrg }).eq("id", userId);
}

/** Ensures a profiles row exists and is linked to the parish (service role when missing). */
export async function ensureParishProfile(
  supabase: SupabaseClient,
  user: User,
  orgId: string,
): Promise<ParishProfileRow | null> {
  let profile = await loadParishProfileRow(supabase, user.id);
  const identity = getAuthDisplayIdentity(user);

  if (profile?.id) {
    const updates: Record<string, string> = {};
    if (!String(profile.org_id ?? "").trim()) updates.org_id = orgId;
    if (!String(profile.full_name ?? "").trim() && identity.fullName) {
      updates.full_name = identity.fullName;
    }
    if (!String(profile.email ?? "").trim() && identity.email) {
      updates.email = identity.email;
    }
    if (Object.keys(updates).length > 0) {
      const { data: updated, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id)
        .select(profileSelect)
        .maybeSingle();
      if (!error && updated) profile = updated as ParishProfileRow;
    }
    return profile;
  }

  try {
    const admin = createAdminClient();
    const { data: created, error } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          org_id: orgId,
          full_name: identity.fullName || null,
          email: identity.email || user.email || null,
          phone: String(user.user_metadata?.phone ?? "").trim() || null,
        },
        { onConflict: "id" },
      )
      .select(profileSelect)
      .single();
    if (error || !created) return null;
    return created as ParishProfileRow;
  } catch {
    return null;
  }
}
