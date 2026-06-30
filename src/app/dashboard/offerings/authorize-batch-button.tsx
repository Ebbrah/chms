"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authorizeOfferingWeekBatch } from "@/lib/actions/weekly-offerings";
import { ActionButton } from "@/components/ui/action-button";

export function AuthorizeBatchButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onAuthorize() {
    if (pending) return;
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
      <ActionButton
        type="button"
        size="sm"
        variant="secondary"
        loading={pending}
        loadingText="Authorizing…"
        onClick={() => void onAuthorize()}
      >
        Authorize
      </ActionButton>
      {msg ? <span className="text-xs text-destructive">{msg}</span> : null}
    </div>
  );
}
