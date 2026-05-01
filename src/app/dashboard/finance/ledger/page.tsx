import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JournalForm } from "./journal-form";
import { LedgerEntryActions } from "./ledger-entry-actions";
import { LedgerAdminControls } from "./ledger-admin-controls";

export default async function LedgerPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("journal_entries")
    .select(
      "id, entry_date, description, source_type, posted_at, posted_by, created_by, reversal_of_entry_id, reversed_by_entry_id, reversed_at, reversed_by, reversal_reason",
    )
    .order("entry_date", { ascending: false })
    .limit(50);
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code");
  const { data: fiscalYears } = await supabase
    .from("fiscal_years")
    .select("id, label")
    .order("start_date", { ascending: false });
  const { data: openingBalanceBatches } = await supabase
    .from("opening_balance_batches")
    .select("id, period_month, version, status")
    .order("period_month", { ascending: false })
    .limit(30);
  const { data: locks } = await supabase
    .from("accounting_period_locks")
    .select("period_month, is_closed")
    .eq("is_closed", true)
    .order("period_month", { ascending: false })
    .limit(12);

  type LineRow = {
    id: string;
    journal_entry_id: string;
    debit: number;
    credit: number;
    memo: string | null;
    accounts: { code?: string } | { code?: string }[] | null;
  };

  const entryIds = (entries ?? []).map((e) => e.id);
  const { data: linesRaw } = entryIds.length
    ? await supabase
        .from("journal_lines")
        .select("id, journal_entry_id, debit, credit, memo, accounts(code)")
        .in("journal_entry_id", entryIds)
    : { data: [] as LineRow[] };

  const lines = (linesRaw ?? []) as LineRow[];
  const linesByEntry = new Map<string, LineRow[]>();
  for (const ln of lines) {
    const jid = ln.journal_entry_id;
    if (!linesByEntry.has(jid)) linesByEntry.set(jid, []);
    linesByEntry.get(jid)!.push(ln);
  }

  const actorIds = Array.from(
    new Set(
      (entries ?? [])
        .flatMap((e) => [e.posted_by, e.created_by, e.reversed_by])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean),
    ),
  );
  const { data: actorProfiles } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const actorById = new Map(
    (actorProfiles ?? []).map((p) => [String(p.id), String(p.full_name ?? "").trim() || p.id.slice(0, 8)]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">General ledger</h1>
      </div>
      <LedgerAdminControls
        accounts={((accounts ?? []) as { id: string; code?: string; name?: string }[])}
        fiscalYears={((fiscalYears ?? []) as { id: string; label?: string }[])}
        batches={((openingBalanceBatches ?? []) as { id: string; period_month: string; version: number; status: string }[])}
      />
      {(locks ?? []).length ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Closed periods: {(locks ?? []).map((l) => String(l.period_month).slice(0, 7)).join(", ")}
        </div>
      ) : null}
      <JournalForm accounts={accounts ?? []} />
      <div className="space-y-4">
        {(entries ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No journal entries.</p>
        ) : (
          (entries ?? []).map((e) => (
            <div key={e.id} className="rounded-md border border-border">
              <div className="border-b border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{e.entry_date}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span>{e.description ?? "—"}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="text-xs uppercase">{e.source_type}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="text-xs">Posted by {actorById.get(String(e.posted_by ?? e.created_by ?? "")) ?? "—"}</span>
                {e.reversed_by_entry_id ? (
                  <>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <Badge variant="destructive">Reversed</Badge>
                    <span className="ml-2 text-xs text-muted-foreground">
                      by {actorById.get(String(e.reversed_by ?? "")) ?? "—"} ({String(e.reversal_reason ?? "No reason")})
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <Badge variant="secondary">Posted</Badge>
                  </>
                )}
                <div className="mt-2">
                  <LedgerEntryActions
                    entryId={String(e.id)}
                    entryDate={String(e.entry_date)}
                    alreadyReversed={Boolean(e.reversed_by_entry_id)}
                  />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead>Memo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(linesByEntry.get(e.id) ?? []).map((ln) => {
                    const ac = Array.isArray(ln.accounts)
                      ? ln.accounts[0]
                      : ln.accounts;
                    return (
                      <TableRow key={String(ln.id)}>
                        <TableCell>{ac?.code}</TableCell>
                        <TableCell className="text-right">
                          {Number(ln.debit) > 0 ? Number(ln.debit).toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(ln.credit) > 0 ? Number(ln.credit).toFixed(2) : "—"}
                        </TableCell>
                        <TableCell>{String(ln.memo ?? "")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
