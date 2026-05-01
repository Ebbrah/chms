import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JournalForm } from "./journal-form";

export default async function LedgerPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("id, entry_date, description, source_type, posted_at")
    .order("entry_date", { ascending: false })
    .limit(50);
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name")
    .eq("is_active", true)
    .order("code");

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">General ledger</h1>
      </div>
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
