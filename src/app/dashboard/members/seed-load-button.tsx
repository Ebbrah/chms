"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { applySeedToUserMember } from "@/lib/actions/member-seeds";
import { Button } from "@/components/ui/button";

export function LoadSeedButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onLoad() {
    setMsg(null);
    setPending(true);
    try {
      const res = await applySeedToUserMember(userId);
      if ("error" in res && res.error) {
        setMsg(res.error);
        return;
      }
      router.refresh();
      setMsg("Loaded.");
      setTimeout(() => setMsg(null), 1500);
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" variant="link" onClick={() => void onLoad()} disabled={pending}>
        {pending ? "Loading…" : "Load data"}
      </Button>
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
    </span>
  );
}

