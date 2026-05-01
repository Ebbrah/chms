import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { MembersWithCardsTable, type MemberRow as MemberRowClient } from "./members-with-cards-table";

type MemberRow = {
  id: string;
  user_id: string | null;
  phone: string | null;
  status: string | null;
  offering_number: string | null;
  household_id: string | null;
  member_details: unknown;
  updated_at: string;
};

export default async function MembersWithCardsPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("members")
    .select(
      "id, user_id, phone, status, offering_number, household_id, member_details, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(1000);

  const householdIds = Array.from(
    new Set((rows ?? []).map((r) => String((r as MemberRow).household_id ?? "")).filter(Boolean)),
  );
  const { data: households } =
    householdIds.length > 0
      ? await supabase.from("households").select("id, name").in("id", householdIds)
      : { data: null };
  const householdNameById = new Map<string, string>();
  for (const h of (households ?? []) as Array<{ id: string; name: string | null }>) {
    householdNameById.set(String(h.id), String(h.name ?? "").trim());
  }

  const latestByUser = new Map<string, MemberRow>();
  for (const row of (rows ?? []) as MemberRow[]) {
    const key = String(row.user_id ?? "");
    if (!key || latestByUser.has(key)) continue;
    latestByUser.set(key, row);
  }

  const membersWithCards = Array.from(latestByUser.values()).filter(
    (m) => Boolean(m.offering_number && String(m.offering_number).trim()),
  );
  membersWithCards.sort((a, b) =>
    String(a.offering_number ?? "").localeCompare(String(b.offering_number ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  const householdNameByIdRecord = Object.fromEntries(householdNameById.entries());
  const membersWithCardsClient: MemberRowClient[] = membersWithCards.map((m) => ({
    id: m.id,
    user_id: m.user_id,
    phone: m.phone,
    status: m.status,
    offering_number: m.offering_number,
    household_id: m.household_id,
    member_details: m.member_details,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members with offering cards</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/members">Back to members</Link>
        </Button>
      </div>

      <MembersWithCardsTable
        membersWithCards={membersWithCardsClient}
        householdNameById={householdNameByIdRecord}
      />
    </div>
  );
}
