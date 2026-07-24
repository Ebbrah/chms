import type { SupabaseClient } from "@supabase/supabase-js";

export type LinkedMemberRow = {
  id?: string;
  status?: string | null;
  offering_number?: string | null;
  org_id?: string | null;
  household_id?: string | null;
  member_details?: unknown;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  join_date?: string | null;
  notes?: string | null;
  pastoral_notes?: string | null;
  user_id?: string | null;
  updated_at?: string | null;
};

const DEFAULT_SELECT =
  "id, status, offering_number, org_id, household_id, member_details, phone, email, address, join_date, notes, pastoral_notes, user_id, updated_at";

function hasAssignedOfferingNumber(offeringNumber: string | null | undefined): boolean {
  return Boolean(String(offeringNumber ?? "").trim());
}

/** Prefer approved/active rows when a user has duplicate member records. */
export function pickCanonicalMemberRow<T extends LinkedMemberRow>(rows: T[]): T | null {
  if (!rows.length) return null;

  const withOffering = rows.filter((row) => hasAssignedOfferingNumber(row.offering_number));
  const pool = withOffering.length > 0 ? withOffering : rows;

  return [...pool].sort((a, b) => {
    const aActive = String(a.status ?? "") === "active" ? 1 : 0;
    const bActive = String(b.status ?? "") === "active" ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;

    const aUpdated = Date.parse(String(a.updated_at ?? "")) || 0;
    const bUpdated = Date.parse(String(b.updated_at ?? "")) || 0;
    return bUpdated - aUpdated;
  })[0];
}

/** Load the signed-in user's member row, scoped to parish org with legacy fallback. */
export async function loadLinkedMemberRow<T extends LinkedMemberRow = LinkedMemberRow>(
  supabase: SupabaseClient,
  userId: string,
  orgId: string | null | undefined,
  select: string = DEFAULT_SELECT,
): Promise<T | null> {
  const trimmedOrg = String(orgId ?? "").trim();
  const rows: T[] = [];

  if (trimmedOrg) {
    const scoped = await supabase
      .from("members")
      .select(select)
      .eq("user_id", userId)
      .eq("org_id", trimmedOrg)
      .order("updated_at", { ascending: false })
      .limit(5);
    if (!scoped.error && scoped.data?.length) {
      rows.push(...(scoped.data as unknown as T[]));
    }
  }

  if (rows.length === 0) {
    const fallback = await supabase
      .from("members")
      .select(select)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(5);
    if (fallback.error || !fallback.data?.length) return null;
    rows.push(...(fallback.data as unknown as T[]));
  }

  return pickCanonicalMemberRow(rows);
}
