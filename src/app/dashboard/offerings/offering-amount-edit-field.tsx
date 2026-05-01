"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateOfferingLine } from "@/lib/actions/weekly-offerings";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Button } from "@/components/ui/button";
import { formatAmountTZS } from "@/lib/format/amount";
import { parseAmountInput } from "@/lib/format/currency-input";

export function OfferingAmountEditField({
  offeringId,
  amount,
  editable,
}: {
  offeringId: string | null;
  amount: number;
  editable: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(amount > 0 ? String(amount) : "");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setValue(amount > 0 ? String(amount) : "");
  }, [amount, editing]);

  async function onSave() {
    if (!offeringId) return;
    setPending(true);
    setMsg(null);
    try {
      const res = await updateOfferingLine({
        offeringId,
        amount: parseAmountInput(value),
      });
      if ("error" in res && res.error) {
        setMsg(res.error);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!editable || !offeringId) {
    return <span>{amount > 0 ? formatAmountTZS(amount) : "—"}</span>;
  }

  return (
    <div className="group flex flex-col items-end gap-1">
      {editing ? (
        <div className="flex items-center gap-1">
          <CurrencyInput
            className="h-8 w-28"
            value={value}
            onValueChange={setValue}
            emptyZero
          />
          <Button
            type="button"
            size="sm"
            onClick={() => void onSave()}
            disabled={pending}
          >
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(false);
              setValue(amount > 0 ? String(amount) : "");
              setMsg(null);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span>{amount > 0 ? formatAmountTZS(amount) : "—"}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => {
              setEditing(true);
              setValue(amount > 0 ? String(amount) : "");
            }}
          >
            Edit
          </Button>
        </div>
      )}
      {msg ? <span className="text-xs text-destructive">{msg}</span> : null}
    </div>
  );
}
