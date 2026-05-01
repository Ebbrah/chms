import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountBase = {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
};

export async function loadAccountBalances(
  supabase: SupabaseClient,
  from?: string,
  to?: string,
) {
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type")
    .order("code");
  let linesQuery = supabase
    .from("journal_lines")
    .select("account_id, debit, credit, journal_entries!inner(entry_date)");
  if (from) linesQuery = linesQuery.gte("journal_entries.entry_date", from);
  if (to) linesQuery = linesQuery.lte("journal_entries.entry_date", to);
  const { data: lines } = await linesQuery;

  const totalsByAccount = new Map<string, { debit: number; credit: number }>();
  for (const row of lines ?? []) {
    const accountId = String((row as { account_id?: string }).account_id ?? "");
    if (!accountId) continue;
    if (!totalsByAccount.has(accountId)) totalsByAccount.set(accountId, { debit: 0, credit: 0 });
    const agg = totalsByAccount.get(accountId)!;
    agg.debit += Number((row as { debit?: number }).debit ?? 0);
    agg.credit += Number((row as { credit?: number }).credit ?? 0);
  }

  const rows = ((accounts ?? []) as AccountBase[]).map((account) => {
    const sums = totalsByAccount.get(String(account.id)) ?? { debit: 0, credit: 0 };
    return {
      ...account,
      debit: sums.debit,
      credit: sums.credit,
      movement: sums.debit - sums.credit,
    };
  });
  return rows;
}
