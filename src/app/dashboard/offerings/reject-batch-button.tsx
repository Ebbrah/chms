"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rejectOfferingWeekBatch } from "@/lib/actions/weekly-offerings";
import { ActionButton } from "@/components/ui/action-button";

export function RejectBatchButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onReject() {
    if (pending) return;
    setMsg(null);
    setPending(true);
    try {
      const res = await rejectOfferingWeekBatch(batchId);
      if ("error" in res && res.error) {
        setMsg(res.error);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <ActionButton
        type="button"
        size="sm"
        variant="outline"
        loading={pending}
        loadingText="Rejecting…"
        onClick={() => void onReject()}
      >
        Reject
      </ActionButton>
      {msg ? <span className="text-xs text-destructive">{msg}</span> : null}
    </div>
  );
}
