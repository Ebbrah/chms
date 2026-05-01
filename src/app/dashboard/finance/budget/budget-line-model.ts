/** Shared shape for budget_lines rows with Supabase embeds (server + client safe). */
export type LineRow = {
  id: string;
  budget_id: string | null;
  account_id: string | null;
  target_id?: string | null;
  amount: number | string | null;
  indicators?: string | null;
  results?: string | null;
  timeframe_start?: string | null;
  timeframe_end?: string | null;
  mhusika?: string | null;
  budgets: { name?: string | null; status?: string | null } | { name?: string | null; status?: string | null }[] | null;
  accounts: { code?: string | null; name?: string | null } | { code?: string | null; name?: string | null }[] | null;
  planning_targets?:
    | {
        name?: string | null;
        indicator?: string | null;
        expected_result?: string | null;
        planning_goals?:
          | {
              name?: string | null;
              planning_priorities?:
                | { name?: string | null }
                | { name?: string | null }[]
                | null;
            }
          | {
              name?: string | null;
              planning_priorities?:
                | { name?: string | null }
                | { name?: string | null }[]
                | null;
            }[]
          | null;
      }
    | {
        name?: string | null;
        indicator?: string | null;
        expected_result?: string | null;
        planning_goals?:
          | {
              name?: string | null;
              planning_priorities?:
                | { name?: string | null }
                | { name?: string | null }[]
                | null;
            }
          | {
              name?: string | null;
              planning_priorities?:
                | { name?: string | null }
                | { name?: string | null }[]
                | null;
            }[]
          | null;
      }[]
    | null;
};

export function one<T extends object>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export function timeframeLabel(start?: string | null, end?: string | null): string {
  if (!start?.trim() && !end?.trim()) return "—";
  return `${start?.trim() || "?"} → ${end?.trim() || "?"}`;
}

export function rowPlanningContext(l: LineRow): { kipaumbele: string; lengo: string; shabaha: string } {
  const t = one(l.planning_targets);
  const g = one(t?.planning_goals ?? null);
  const p = one(g?.planning_priorities ?? null);
  return {
    kipaumbele: p?.name?.trim() ? String(p.name) : "—",
    lengo: g?.name?.trim() ? String(g.name) : "—",
    shabaha: t?.name?.trim() ? String(t.name) : "—",
  };
}
