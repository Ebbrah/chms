import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyRoles } from "@/lib/auth/session";
import { canFinance } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import {
  UnregisteredSeedsTable,
  type UnregisteredSeedRow,
} from "./unregistered-seeds-table";

type MemberSeedRow = UnregisteredSeedRow & { updated_at: string };

type MemberOfferingRow = {
  offering_number: string | null;
};

export default async function UnregisteredSeedsPage() {
  const roles = await getMyRoles();
  if (!canFinance(roles)) redirect("/dashboard/members");

  const supabase = await createClient();

  const { data: seeds, error: seedsError } = await supabase
    .from("member_seeds")
    .select(
      "id,offering_number,full_name,gender,phone,pledge_ahadi,pledge_jengo,pledge_dayosisi,updated_at",
    )
    .order("updated_at", { ascending: false });

  if (seedsError) {
    throw new Error(seedsError.message);
  }

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("offering_number")
    .not("offering_number", "is", null);

  if (membersError) {
    throw new Error(membersError.message);
  }

  const registeredOfferingNumbers = new Set(
    ((members ?? []) as MemberOfferingRow[])
      .map((m) => String(m.offering_number ?? "").trim())
      .filter(Boolean),
  );

  const unregisteredSeeds = ((seeds ?? []) as MemberSeedRow[]).filter(
    (seed) => !registeredOfferingNumbers.has(String(seed.offering_number ?? "").trim()),
  );
  const sortedUnregisteredSeeds = [...unregisteredSeeds].sort((a, b) =>
    a.offering_number.localeCompare(b.offering_number, undefined, {
      numeric: true,
      sensitivity: "base",
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Uploaded but not registered</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/members">Back to members</Link>
          </Button>
        </div>
      </div>
      <UnregisteredSeedsTable
        unmatchedRows={sortedUnregisteredSeeds}
        allRows={(seeds ?? []) as UnregisteredSeedRow[]}
      />
    </div>
  );
}
