import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAuthDisplayIdentity } from "@/lib/auth/user-identity";
import { getSessionUser } from "@/lib/auth/session";
import {
  ensureParishProfile,
  loadParishProfileRow,
  reconcileProfileOrgForMemberReads,
} from "@/lib/members/ensure-parish-profile";
import { getResolvedParishOrgId, loadSignedInMemberContext } from "@/lib/members/registration-state";
import { loadLinkedMemberRow } from "@/lib/members/load-linked-member";
import { loadEldersForHousehold, type LeaderProfile } from "@/lib/members/household-leaders";
import { sanitizeMemberDetailsForDisplay } from "@/lib/members/sanitize-member-details";

export type MemberProfileReportData = {
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
  member: {
    offering_number: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    member_details: unknown;
  } | null;
  household: { name: string | null } | null;
  elders: LeaderProfile[];
};

export type MemberProfileReportLoadResult =
  | { ok: true; data: MemberProfileReportData }
  | { ok: false; reason: "not_found" | "profile_error" | "member_error" };

/** Minimal, parallelized reads for the member profile report (deduped per RSC request). */
export const loadMemberProfileReportData = cache(
  async (profileId: string): Promise<MemberProfileReportLoadResult> => {
    const sessionUser = await getSessionUser();
    if (sessionUser?.id === profileId) {
      const ctx = await loadSignedInMemberContext();
      if (ctx?.profile) {
        const householdId = ctx.member?.household_id ?? null;
        const supabase = await createClient();
        const [{ data: household }, elders] = await Promise.all([
          householdId
            ? supabase.from("households").select("name").eq("id", String(householdId)).maybeSingle()
            : Promise.resolve({ data: null }),
          loadEldersForHousehold(supabase, householdId),
        ]);

        return {
          ok: true,
          data: {
            profile: {
              id: ctx.profile.id,
              full_name: ctx.profile.full_name,
              email: ctx.profile.email,
            },
            member: ctx.member
              ? {
                  offering_number: ctx.member.offering_number ?? null,
                  phone: ctx.member.phone ?? null,
                  email: ctx.member.email ?? null,
                  address: ctx.member.address ?? null,
                  member_details: sanitizeMemberDetailsForDisplay(ctx.member.member_details),
                }
              : null,
            household: household ? { name: household.name } : null,
            elders,
          },
        };
      }
    }

    const supabase = await createClient();

    let profile = await loadParishProfileRow(supabase, profileId);

    if (!profile) {
      const orgId = sessionUser?.id === profileId ? await getResolvedParishOrgId() : null;
      if (sessionUser && orgId) {
        profile = await ensureParishProfile(supabase, sessionUser, orgId);
      }
    }

    if (!profile) {
      if (sessionUser?.id === profileId) {
        const identity = getAuthDisplayIdentity(sessionUser);
        if (identity.fullName || identity.email) {
          return {
            ok: true,
            data: {
              profile: {
                id: profileId,
                full_name: identity.fullName || null,
                email: identity.email || null,
              },
              member: null,
              household: null,
              elders: [],
            },
          };
        }
      }
      return { ok: false, reason: "not_found" };
    }

    const memberSelect =
      "id, offering_number, phone, email, address, household_id, member_details, updated_at, org_id, status";
    type MemberRow = {
      id?: string;
      offering_number: string | null;
      phone: string | null;
      email: string | null;
      address: string | null;
      household_id: string | null;
      member_details: unknown;
      updated_at: string;
      org_id?: string | null;
      status?: string | null;
    };

    let resolvedOrgId = profile.org_id;
    if (sessionUser?.id === profileId) {
      resolvedOrgId =
        (await reconcileProfileOrgForMemberReads(supabase, profileId, profile.org_id)) ??
        (await getResolvedParishOrgId());
    }

    const member = await loadLinkedMemberRow<MemberRow>(
      supabase,
      profileId,
      resolvedOrgId,
      memberSelect,
    );

    const householdId = member?.household_id ?? null;
    const [{ data: household }, elders] = await Promise.all([
      householdId
        ? supabase.from("households").select("name").eq("id", String(householdId)).maybeSingle()
        : Promise.resolve({ data: null }),
      loadEldersForHousehold(supabase, householdId),
    ]);

    return {
      ok: true,
      data: {
        profile: {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
        },
        member: member
          ? {
              offering_number: member.offering_number,
              phone: member.phone,
              email: member.email,
              address: member.address,
              member_details: sanitizeMemberDetailsForDisplay(member.member_details),
            }
          : null,
        household: household ? { name: household.name } : null,
        elders,
      },
    };
  },
);
