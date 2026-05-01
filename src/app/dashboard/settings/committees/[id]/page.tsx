import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { EditCommitteeForm } from "./edit-committee-form";

export default async function EditCommitteePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: committee } = await supabase
    .from("committees")
    .select("id, name, chairperson_name, chairperson_user_id")
    .eq("id", id)
    .single();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let chairpersonOptions: Array<{ id: string; full_name: string | null }> = [];
  if (user?.id) {
    const { data: me } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();
    const orgId = String(me?.org_id ?? "").trim();
    if (orgId) {
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("role", "committee_head");
      const userIds = Array.from(
        new Set((roleRows ?? []).map((r) => String(r.user_id ?? "")).filter(Boolean)),
      );
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds)
          .order("full_name", { ascending: true });
        chairpersonOptions = (profiles ?? []) as Array<{ id: string; full_name: string | null }>;
      }
    }
  }

  if (!committee) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Edit committee</h1>
        <Button variant="outline" asChild>
          <Link href="/dashboard/settings/committees">Back</Link>
        </Button>
      </div>
      <EditCommitteeForm
        id={committee.id}
        name={committee.name ?? ""}
        chairpersonUserId={String(committee.chairperson_user_id ?? "")}
        chairpersonOptions={chairpersonOptions}
      />
    </div>
  );
}
