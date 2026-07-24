import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  canEditOwnMemberProfile,
  getMemberRegistrationState,
  getResolvedParishOrgId,
} from "@/lib/members/registration-state";
import { loadMemberEditFormData } from "@/lib/members/member-form-data";
import { loadLinkedMemberRow } from "@/lib/members/load-linked-member";
import { MemberEditForm } from "@/app/dashboard/members/[id]/member-edit-form";
import { Button } from "@/components/ui/button";

export default async function MyProfileEditPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [canEdit, registrationState, orgId] = await Promise.all([
    canEditOwnMemberProfile(),
    getMemberRegistrationState(),
    getResolvedParishOrgId(),
  ]);
  if (!canEdit) {
    redirect("/dashboard/my-profile");
  }

  if (registrationState?.kind === "needs_onboarding") {
    redirect("/dashboard/complete-registration");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, org_id")
    .eq("id", user.id)
    .single();
  if (!profile?.id) redirect("/dashboard");
  if (!orgId) redirect("/dashboard");

  const member = await loadLinkedMemberRow(supabase, user.id, orgId, "*");

  const { households, churchElderOptions, jumuiyaChairOptions } =
    await loadMemberEditFormData(orgId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Edit my profile</h1>
        <Button variant="outline" asChild>
          <Link href="/dashboard/my-profile">Back to profile report</Link>
        </Button>
      </div>
      <MemberEditForm
        userId={profile.id}
        fullName={profile.full_name ?? ""}
        email={member?.email ?? profile.email ?? ""}
        member={member}
        households={households}
        churchElderOptions={churchElderOptions}
        jumuiyaChairOptions={jumuiyaChairOptions}
        allowEditDisplayName={false}
        mode="self"
      />
    </div>
  );
}
