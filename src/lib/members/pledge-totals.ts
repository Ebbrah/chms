import type { SupabaseClient } from "@supabase/supabase-js";

export type PledgeBucketTotals = {
  ahadi: number;
  jengo: number;
  dayosisi: number;
};

/** Year-to-date giving totals by pledge bucket — uses SQL aggregate when RPC is available. */
export async function loadMemberYearlyPledgeTotals(
  supabase: SupabaseClient,
  memberId: string,
  year: number,
): Promise<PledgeBucketTotals> {
  const { data, error } = await supabase.rpc("get_member_yearly_pledge_totals", {
    _member_id: memberId,
    _year: year,
  });

  if (!error && data) {
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      return {
        ahadi: Number(row.ahadi ?? 0),
        jengo: Number(row.jengo ?? 0),
        dayosisi: Number(row.dayosisi ?? 0),
      };
    }
  }

  // RPC missing or failed — return zeros instead of pulling thousands of offering rows.
  return { ahadi: 0, jengo: 0, dayosisi: 0 };
}
