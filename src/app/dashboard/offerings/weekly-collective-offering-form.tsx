"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveWeeklyCollectiveOffering } from "@/lib/actions/weekly-offerings";
import {
  formatDateISO,
  OFFERING_BATCH_SLOT_FIRST_SERVICE,
  OFFERING_BATCH_SLOT_MIDWEEK,
  OFFERING_BATCH_SLOT_SECOND_SERVICE,
  offeringBatchSlotLabel,
} from "@/lib/offering/weekly";
import { ActionButton } from "@/components/ui/action-button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { parseAmountInput } from "@/lib/format/currency-input";
import { Label } from "@/components/ui/label";

type OfferingTypeOption = { id: string; name: string };

export function WeeklyCollectiveOfferingForm({
  offeringTypes,
  defaultWeekOf,
  defaultBatchSlot = OFFERING_BATCH_SLOT_MIDWEEK,
}: {
  offeringTypes: OfferingTypeOption[];
  defaultWeekOf?: string;
  /** Which weekly batch (1–3) this entry attaches to */
  defaultBatchSlot?: number;
}) {
  const router = useRouter();
  const [weekOf, setWeekOf] = useState(() => defaultWeekOf ?? formatDateISO(new Date()));
  const [batchSlot, setBatchSlot] = useState(defaultBatchSlot);
  const [offeringTypeId, setOfferingTypeId] = useState(offeringTypes[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSave() {
    if (pending) return;
    setMsg(null);
    setErr(null);
    setPending(true);
    try {
      const res = await saveWeeklyCollectiveOffering(
        weekOf,
        offeringTypeId,
        parseAmountInput(amount),
        batchSlot,
      );
      if ("error" in res && res.error) {
        setErr(res.error);
        return;
      }
      setMsg("Collective offering saved.");
      setAmount("");
      if ("batchId" in res && res.batchId) {
        router.push(
          `/dashboard/offerings?registeredBatchId=${encodeURIComponent(String(res.batchId))}&collectivePage=1#other-offerings-preview`,
        );
      } else {
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="collective-batch-slot">Batch (service)</Label>
          <select
            id="collective-batch-slot"
            value={batchSlot}
            onChange={(e) => setBatchSlot(Number(e.target.value))}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value={OFFERING_BATCH_SLOT_FIRST_SERVICE}>
              {offeringBatchSlotLabel(OFFERING_BATCH_SLOT_FIRST_SERVICE)}
            </option>
            <option value={OFFERING_BATCH_SLOT_SECOND_SERVICE}>
              {offeringBatchSlotLabel(OFFERING_BATCH_SLOT_SECOND_SERVICE)}
            </option>
            <option value={OFFERING_BATCH_SLOT_MIDWEEK}>
              {offeringBatchSlotLabel(OFFERING_BATCH_SLOT_MIDWEEK)}
            </option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="collective-week-of">Week</Label>
          <Input
            id="collective-week-of"
            type="date"
            value={weekOf}
            onChange={(e) => setWeekOf(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="collective-type">Offering type</Label>
          <select
            id="collective-type"
            value={offeringTypeId}
            onChange={(e) => setOfferingTypeId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {offeringTypes.length === 0 ? (
              <option value="">No offering types available</option>
            ) : (
              offeringTypes.map((ot) => (
                <option key={ot.id} value={ot.id}>
                  {ot.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="collective-amount">Amount (TZS)</Label>
          <CurrencyInput
            id="collective-amount"
            value={amount}
            onValueChange={setAmount}
            placeholder="0"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <ActionButton
          type="button"
          onClick={() => void onSave()}
          loading={pending}
          loadingText="Saving…"
          disabled={!offeringTypeId || offeringTypes.length === 0}
        >
          Save / Hifadhi
        </ActionButton>
      </div>

      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </div>
  );
}
