"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authorizeOfferingWeekBatch } from "@/lib/actions/weekly-offerings";
import { Button } from "@/components/ui/button";

export function AuthorizeBatchButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onAuthorize() {
    setMsg(null);
    setPending(true);
    try {
      const res = await authorizeOfferingWeekBatch(batchId);
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
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => void onAuthorize()}>
        {pending ? "…" : "Authorize"}
      </Button>
      {msg ? <span className="text-xs text-destructive">{msg}</span> : null}
    </div>
  );
}
