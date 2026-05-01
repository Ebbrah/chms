"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveOfferingWeekBatch } from "@/lib/actions/weekly-offerings";
import { Button } from "@/components/ui/button";

export function ApproveBatchButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onApprove() {
    setMsg(null);
    setPending(true);
    try {
      const res = await approveOfferingWeekBatch(batchId);
      if ("error" in res && res.error) {
        setMsg(res.error);
        return;
      }
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not approve this batch.";
      setMsg(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" variant="default" disabled={pending} onClick={() => void onApprove()}>
        {pending ? "…" : "Approve"}
      </Button>
      {msg ? <span className="text-xs text-destructive">{msg}</span> : null}
    </div>
  );
}
