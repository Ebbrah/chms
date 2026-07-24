import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getSessionUser } from "@/lib/auth/session";
import { mergeProfileWithAuthIdentity } from "@/lib/auth/user-identity";
import {
  getMemberRegistrationState,
  getResolvedParishOrgId,
} from "@/lib/members/registration-state";
import { loadMemberEditFormData } from "@/lib/members/member-form-data";
import { loadLinkedMemberRow } from "@/lib/members/load-linked-member";
import { MemberEditForm } from "@/app/dashboard/members/[id]/member-edit-form";

export default async function CompleteRegistrationPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [state, profile, orgId] = await Promise.all([
    getMemberRegistrationState(),
    getProfile(),
    getResolvedParishOrgId(),
  ]);

  if (state?.kind === "pending_approval") redirect("/dashboard?registration=submitted");
  if (state?.kind === "active") redirect("/dashboard/my-profile");
  if (state?.kind !== "needs_onboarding" || !orgId) redirect("/dashboard");

  const supabase = await createClient();
  const existingMember = await loadLinkedMemberRow(supabase, user.id, orgId, "*");

  const { households, churchElderOptions, jumuiyaChairOptions } =
    await loadMemberEditFormData(orgId);

  const identity = mergeProfileWithAuthIdentity(profile, user);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Complete registration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome! Please complete your member profile so the parish can assign your offering number.
        </p>
      </div>
      <MemberEditForm
        userId={profile?.id ?? user.id}
        fullName={identity.fullName}
        email={identity.email}
        member={existingMember}
        households={households}
        churchElderOptions={churchElderOptions}
        jumuiyaChairOptions={jumuiyaChairOptions}
        allowEditDisplayName={false}
        mode="onboarding"
      />
    </div>
  );
}
