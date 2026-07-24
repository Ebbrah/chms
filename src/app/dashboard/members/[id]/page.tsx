import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MemberEditForm } from "./member-edit-form";
import { getMyRoles } from "@/lib/auth/session";
import { canFinance } from "@/lib/auth/permissions";
import { loadMemberEditFormData } from "@/lib/members/member-form-data";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, org_id")
    .eq("id", id)
    .single();
  if (!profile?.org_id) notFound();

  const orgId = String(profile.org_id);

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", id)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { households, churchElderOptions, jumuiyaChairOptions } =
    await loadMemberEditFormData(orgId);

  const roles = await getMyRoles();
  const allowEditDisplayName = canFinance(roles);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Edit member</h1>
        <Button variant="outline" asChild>
          <Link href="/dashboard/members">Back</Link>
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
        allowEditDisplayName={allowEditDisplayName}
      />
    </div>
  );
}
