import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { canFinance, canPastoral, hasRole } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/auth/roles";
import { getProfile, getSessionUser, getMyRoles } from "@/lib/auth/session";
import {
  loadParishProfileRow,
  reconcileProfileOrgForMemberReads,
} from "@/lib/members/ensure-parish-profile";
import {
  loadLinkedMemberRow,
  pickCanonicalMemberRow,
  type LinkedMemberRow,
} from "@/lib/members/load-linked-member";
import { createAdminClient } from "@/lib/supabase/admin";

export type MemberRegistrationState =
  | { kind: "needs_onboarding" }
  | { kind: "pending_approval" }
  | { kind: "active" }
  | { kind: "no_member_record" };

function hasAssignedOfferingNumber(offeringNumber: string | null | undefined): boolean {
  return Boolean(String(offeringNumber ?? "").trim());
}

/** Staff accounts without a member role should not enter parish onboarding. */
function isStaffOnlyAccount(roles: AppRole[]): boolean {
  return (
    !hasRole(roles, "member") &&
    (canPastoral(roles) ||
      canFinance(roles) ||
      hasRole(roles, "church_elder") ||
      hasRole(roles, "jumuiya_chairman") ||
      hasRole(roles, "committee_head") ||
      hasRole(roles, "evangelist"))
  );
}

async function userHasMemberRoleInOrg(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
): Promise<boolean> {
  // Unscoped read — RLS allows user_id = auth.uid(); avoids org filter mismatches.
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role, org_id")
    .eq("user_id", userId);

  if (
    (roleRows ?? []).some(
      (row) => row.role === "member" && String(row.org_id ?? "") === String(orgId),
    )
  ) {
    return true;
  }

  // Legacy rows may have member role with a null org_id (pre–multi-parish).
  if ((roleRows ?? []).some((row) => row.role === "member" && !String(row.org_id ?? "").trim())) {
    return true;
  }

  const roles = await getMyRoles();
  return hasRole(roles, "member");
}

/** Parish join-link signup sets profile.org_id before a members row exists. */
function hasParishProfileOrgId(profileOrgId: string | null | undefined): boolean {
  return Boolean(String(profileOrgId ?? "").trim());
}

/** Resolve parish org from profile, member role, or linked member row (legacy-safe). */
export async function resolveParishOrgId(
  supabase: SupabaseClient,
  userId: string,
  profileOrgId: string | null | undefined,
): Promise<string | null> {
  if (hasParishProfileOrgId(profileOrgId)) {
    return String(profileOrgId);
  }

  // Cached profile reads can be empty while the row exists — re-read org_id directly.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .maybeSingle();
  if (hasParishProfileOrgId(profileRow?.org_id)) {
    return String(profileRow!.org_id);
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("org_id, role")
    .eq("user_id", userId);

  const memberOrg = (roleRows ?? []).find(
    (row) => row.role === "member" && String(row.org_id ?? "").trim(),
  )?.org_id;
  if (memberOrg) return String(memberOrg);

  const { data: memberRows } = await supabase
    .from("members")
    .select("org_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  const memberOrgId = memberRows?.[0]?.org_id;
  return memberOrgId ? String(memberOrgId) : null;
}

async function shouldEnterOnboardingPath(
  supabase: SupabaseClient,
  userId: string,
  orgId: string,
): Promise<boolean> {
  if (await userHasMemberRoleInOrg(supabase, userId, orgId)) {
    return true;
  }

  const roles = await getMyRoles();
  if (isStaffOnlyAccount(roles)) {
    return false;
  }

  // Parish signup always assigns org_id on the profile before creating a members row.
  return hasParishProfileOrgId(orgId);
}

function stateFromMember(member: {
  status?: string | null;
  offering_number?: string | null;
}): MemberRegistrationState {
  if (hasAssignedOfferingNumber(member.offering_number)) {
    return { kind: "active" };
  }
  if (member.status === "pending_offering_number") {
    return { kind: "pending_approval" };
  }
  return { kind: "needs_onboarding" };
}

/** True when the user should see “Complete registration”. */
export function shouldShowCompleteRegistration(
  state: MemberRegistrationState | null | undefined,
): boolean {
  return state?.kind === "needs_onboarding";
}

/** Load profile report for any signed-in parish member (including pending approval). */
export function shouldLoadProfileReport(
  state: MemberRegistrationState | null | undefined,
): boolean {
  return state != null && state.kind !== "no_member_record";
}

const SIGNED_IN_MEMBER_SELECT =
  "id, status, offering_number, org_id, household_id, member_details, phone, email, address, join_date, notes, pastoral_notes, user_id, updated_at";

export type SignedInMemberContext = {
  userId: string;
  profile: Awaited<ReturnType<typeof loadParishProfileRow>>;
  orgId: string | null;
  member: LinkedMemberRow | null;
  registrationState: MemberRegistrationState;
};

/**
 * Single loader for the signed-in member — shared by dashboard, profile report, and registration gates.
 * Aligns profile.org_id first, then reads the canonical members row (same path for seed and approved members).
 */
export const loadSignedInMemberContext = cache(async (): Promise<SignedInMemberContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  let profile = await loadParishProfileRow(supabase, user.id);

  let orgId =
    (await reconcileProfileOrgForMemberReads(supabase, user.id, profile?.org_id ?? null)) ??
    (await resolveParishOrgId(supabase, user.id, profile?.org_id ?? null));

  if (orgId && String(profile?.org_id ?? "") !== String(orgId)) {
    profile = await loadParishProfileRow(supabase, user.id);
  }

  let member: LinkedMemberRow | null = orgId
    ? await loadLinkedMemberRow(supabase, user.id, orgId, SIGNED_IN_MEMBER_SELECT)
    : null;

  // Self-read still empty after org sync — discover canonical row via service role, then retry.
  if (!member?.id) {
    try {
      const admin = createAdminClient();
      const { data: adminRows } = await admin
        .from("members")
        .select(SIGNED_IN_MEMBER_SELECT)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5);

      const canonical = pickCanonicalMemberRow(adminRows ?? []);
      const memberOrg = String(canonical?.org_id ?? "").trim();

      if (memberOrg) {
        if (memberOrg !== String(profile?.org_id ?? "").trim()) {
          await supabase.from("profiles").update({ org_id: memberOrg }).eq("id", user.id);
          profile = await loadParishProfileRow(supabase, user.id);
        }
        orgId = memberOrg;
        member =
          (await loadLinkedMemberRow(supabase, user.id, memberOrg, SIGNED_IN_MEMBER_SELECT)) ??
          canonical;
      }
    } catch {
      // Service role unavailable — fall through with null member.
    }
  }

  let registrationState: MemberRegistrationState;
  if (!orgId) {
    registrationState = { kind: "no_member_record" };
  } else if (!member?.id) {
    registrationState = (await shouldEnterOnboardingPath(supabase, user.id, orgId))
      ? { kind: "needs_onboarding" }
      : { kind: "no_member_record" };
  } else {
    registrationState = stateFromMember(member);
  }

  return {
    userId: user.id,
    profile,
    orgId,
    member,
    registrationState,
  };
});

/** Cached parish org for pages and server actions (matches registration-state resolution). */
export const getResolvedParishOrgId = cache(async (): Promise<string | null> => {
  const ctx = await loadSignedInMemberContext();
  return ctx?.orgId ?? null;
});

/** Determines whether the user must complete second-tier registration or is waiting for approval. */
export const getMemberRegistrationState = cache(async (): Promise<MemberRegistrationState | null> => {
  const ctx = await loadSignedInMemberContext();
  return ctx?.registrationState ?? null;
});

/**
 * Self-service profile edit (my-profile/edit): after initial registration is submitted
 * or the member already has a seed-linked offering number. Users without an offering
 * number must use complete-registration first (includes pledges).
 */
export const canEditOwnMemberProfile = cache(async (): Promise<boolean> => {
  const state = await getMemberRegistrationState();
  return state?.kind === "active" || state?.kind === "pending_approval";
});

export async function canManagePendingRegistrations(): Promise<boolean> {
  const roles = await getMyRoles();
  return canFinance(roles);
}
