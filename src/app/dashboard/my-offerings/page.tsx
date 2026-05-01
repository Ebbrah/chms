import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { MemberOfferingsClient } from "@/components/offerings/member-offerings-client";

export default async function MyOfferingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!member?.id) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">My offerings</h1>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to dashboard</Link>
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
          <h1 className="text-2xl font-semibold tracking-tight">My offerings</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back</Link>
        </Button>
      </div>
      <MemberOfferingsClient rows={rows ?? []} />
    </div>
  );
}
