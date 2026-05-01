"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOfferingLine } from "@/lib/actions/weekly-offerings";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { parseAmountInput } from "@/lib/format/currency-input";

export function EditOfferingAmountButton({
  offeringId,
  currentAmount,
}: {
  offeringId: string;
  currentAmount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(currentAmount));
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSave() {
    setPending(true);
    setMsg(null);
    try {
      const res = await updateOfferingLine({
        offeringId,
        amount: parseAmountInput(amount),
      });
      if ("error" in res && res.error) {
        setMsg(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
        Edit
      </Button>
    );
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <CurrencyInput
        className="h-8 w-32"
        value={amount}
        onValueChange={setAmount}
        emptyZero={false}
      />
      <Button type="button" size="sm" disabled={pending} onClick={() => void onSave()}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>
        Cancel
      </Button>
      {msg ? <span className="text-xs text-destructive">{msg}</span> : null}
    </div>
  );
}
