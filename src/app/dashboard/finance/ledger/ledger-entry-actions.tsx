"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reverseJournalEntry } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LedgerEntryActions({
  entryId,
  entryDate,
  alreadyReversed,
}: {
  entryId: string;
  entryDate: string;
  alreadyReversed: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [date, setDate] = useState(entryDate);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onReverse() {
    setMsg(null);
    if (!reason.trim()) {
      setMsg("Reversal reason is required.");
      return;
    }
    setBusy(true);
    const res = await reverseJournalEntry(entryId, reason, date);
    setBusy(false);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setMsg("Reversed.");
    setReason("");
    router.refresh();
  }

  if (alreadyReversed) return <span className="text-xs text-muted-foreground">Reversed</span>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-8 w-[150px]"
      />
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason"
        className="h-8 w-[220px]"
      />
      <Button type="button" size="sm" variant="outline" onClick={() => void onReverse()} disabled={busy}>
        {busy ? "Reversing..." : "Reverse"}
      </Button>
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </div>
  );
}
