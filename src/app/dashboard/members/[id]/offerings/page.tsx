import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, getMyRoles } from "@/lib/auth/session";
import { canPastoral } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { MemberOfferingsClient } from "@/components/offerings/member-offerings-client";

export default async function MemberOfferingsHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const roles = await getMyRoles();
  if (session.id !== id && !canPastoral(roles)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", id).single();
  if (!profile) notFound();

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!member?.id) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Offerings — {profile.full_name ?? "Member"}</h1>
        <Button variant="outline" asChild>
          <Link href="/dashboard/members">Back</Link>
        </Button>
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("offerings")
    .select("id, amount, received_at, offering_types(name)")
    .eq("member_id", member.id)
    .order("received_at", { ascending: false })
    .limit(2000);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Offerings — {profile.full_name ?? "Member"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/members/${id}`}>Edit member</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/offerings">Offerings</Link>
          </Button>
        </div>
      </div>
      <MemberOfferingsClient rows={rows ?? []} />
    </div>
  );
}
