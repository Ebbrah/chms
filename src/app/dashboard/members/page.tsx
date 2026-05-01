import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MembersTable, type MemberRow, type ProfileRow } from "./members-table";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone")
    .order("created_at", { ascending: false });
  const { data: members } = await supabase
    .from("members")
    .select("id, user_id, email, phone, offering_number, status")
    .order("created_at", { ascending: false });

  const membersByUser = new Map<string, MemberRow>();
  for (const m of members ?? []) {
    const key = String(m.user_id ?? "");
    if (!key || membersByUser.has(key)) continue;
    membersByUser.set(key, m);
  }

  const membersByUserRecord: Record<string, MemberRow> = {};
  for (const [key, value] of membersByUser.entries()) {
    membersByUserRecord[key] = value;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/members/unregistered-seeds">Uploaded but not registered</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/members/cards">Members with offering cards</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/members/import">Import from Excel</Link>
          </Button>
        </div>
      </div>
      <MembersTable profiles={(profiles ?? []) as ProfileRow[]} membersByUser={membersByUserRecord} />
    </div>
  );
}
