"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  lookupMemberByExactOfferingNumber,
  recordMemberOtherPledge,
  type OfferingNumberLookupRow,
} from "@/lib/actions/member-pledges";
import {
  OFFERING_BATCH_SLOT_FIRST_SERVICE,
  OFFERING_BATCH_SLOT_MIDWEEK,
  OFFERING_BATCH_SLOT_SECOND_SERVICE,
  offeringBatchSlotLabel,
} from "@/lib/offering/weekly";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { parseAmountInput } from "@/lib/format/currency-input";
import { toDisplayCaps } from "@/lib/format/name";
import { Label } from "@/components/ui/label";

const LOOKUP_DEBOUNCE_MS = 350;

type OfferingTypeOption = { id: string; name: string };

export function OtherPledgesForm({
  defaultBatchSlot = OFFERING_BATCH_SLOT_MIDWEEK,
  offeringTypes = [],
}: {
  defaultBatchSlot?: number;
  offeringTypes?: OfferingTypeOption[];
}) {
  const router = useRouter();
  const [batchSlot, setBatchSlot] = useState(defaultBatchSlot);
  const [noOfferingNumber, setNoOfferingNumber] = useState(false);
  const [offeringNumber, setOfferingNumber] = useState("");
  const [lookup, setLookup] = useState<OfferingNumberLookupRow | null>(null);
  const [pledgeDate, setPledgeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [offeringTypeName, setOfferingTypeName] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [manualFullName, setManualFullName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualJumuiya, setManualJumuiya] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const lookupSeq = useRef(0);

  const displayName = noOfferingNumber
    ? manualFullName
    : lookup
      ? toDisplayCaps(lookup.fullName)
      : "";
  const displayPhone = noOfferingNumber ? manualPhone : (lookup?.phone ?? "");
  const displayJumuiya = noOfferingNumber ? manualJumuiya : (lookup?.jumuiyaName ?? "");

  const runOfferingLookup = useCallback(async (query: string) => {
    const q = query.trim();
    if (noOfferingNumber || !q) {
      setLookup(null);
      return;
    }

    const seq = ++lookupSeq.current;
    setErr(null);
    const res = await lookupMemberByExactOfferingNumber(q);
    if (seq !== lookupSeq.current) return;
    if ("error" in res && res.error) {
      setErr(res.error);
      setLookup(null);
      return;
    }
    if ("found" in res && res.found && res.row) {
      setLookup(res.row);
      setOfferingNumber(res.row.offeringNumber);
    } else {
      setLookup(null);
    }
  }, [noOfferingNumber]);

  useEffect(() => {
    if (noOfferingNumber) {
      setLookup(null);
      return;
    }
    const q = offeringNumber.trim();
    if (!q) {
      setLookup(null);
      return;
    }

    const handle = window.setTimeout(() => {
      void runOfferingLookup(q);
    }, LOOKUP_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [offeringNumber, noOfferingNumber, runOfferingLookup]);

  async function onSave() {
    if (pending) return;
    setMsg(null);
    setErr(null);
    if (noOfferingNumber) {
      if (!manualFullName.trim()) {
        setErr("Andika jina kamili kwa asiye na namba ya sadaka.");
        return;
      }
    } else if (!lookup) {
      setErr("Hakuna msharika aliye na namba hii ya sadaka. Angalia namba na ujaribu tena.");
      return;
    }
    const pledgeTitle = offeringTypeName.trim();
    if (!pledgeTitle) {
      setErr("Chagua aina ya sadaka.");
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      if (!noOfferingNumber && lookup?.memberId) fd.set("member_id", lookup.memberId);
      fd.set("pledge_date", pledgeDate);
      fd.set("title", pledgeTitle);
      fd.set("amount", String(parseAmountInput(amount)));
      fd.set("paid_amount", String(parseAmountInput(paidAmount)));
      if (noOfferingNumber) {
        fd.set("full_name", manualFullName.trim());
        fd.set("phone_number", manualPhone.trim());
        fd.set("jumuiya_name", manualJumuiya.trim());
      } else if (lookup) {
        fd.set("full_name", lookup.fullName.trim());
        fd.set("phone_number", lookup.phone.trim());
        fd.set("jumuiya_name", lookup.jumuiyaName.trim());
        if (!lookup.memberId) {
          fd.set("full_name", lookup.fullName.trim());
        }
      }
      fd.set("batch_slot", String(batchSlot));
      const res = await recordMemberOtherPledge(fd);
      if ("error" in res && res.error) {
        setErr(res.error);
        return;
      }
      setMsg("Ahadi nyingine imehifadhiwa.");
      setOfferingTypeName("");
      setAmount("");
      setPaidAmount("");
      setLookup(null);
      setOfferingNumber("");
      setManualFullName("");
      setManualPhone("");
      setManualJumuiya("");
      // Refresh tables in the background without navigating away from the form.
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <Badge
          variant="outline"
          className={
            noOfferingNumber
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-emerald-300 bg-emerald-50 text-emerald-800"
          }
        >
          {noOfferingNumber ? "Mode: Unregistered" : "Mode: Registered"}
        </Badge>
      </div>
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={noOfferingNumber}
          onChange={(e) => {
            const next = e.target.checked;
            setNoOfferingNumber(next);
            if (next) {
              setLookup(null);
              setOfferingNumber("");
            }
          }}
          className="h-4 w-4 rounded border-input"
        />
        Hana namba ya sadaka (record as unregistered)
      </label>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="pledge-batch-slot">Batch</Label>
          <select
            id="pledge-batch-slot"
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
          <Label htmlFor="pledge-offering-number">Namba ya msharika</Label>
          <Input
            id="pledge-offering-number"
            value={offeringNumber}
            onChange={(e) => {
              setOfferingNumber(e.target.value);
              setLookup(null);
            }}
            onBlur={() => {
              void runOfferingLookup(offeringNumber);
            }}
            placeholder="Andika namba kamili…"
            autoComplete="off"
            disabled={noOfferingNumber}
            className="font-mono"
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pledge-full-name">Jina kamili</Label>
          <Input
            id="pledge-full-name"
            value={displayName}
            onChange={(e) => setManualFullName(e.target.value)}
            placeholder="Mfano: Juma Peter"
            disabled={!noOfferingNumber}
            readOnly={!noOfferingNumber && Boolean(lookup)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pledge-phone">Simu</Label>
          <Input
            id="pledge-phone"
            value={displayPhone}
            onChange={(e) => setManualPhone(e.target.value)}
            placeholder="07..."
            disabled={!noOfferingNumber}
            readOnly={!noOfferingNumber && Boolean(lookup)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pledge-jumuiya">Jumuiya</Label>
          <Input
            id="pledge-jumuiya"
            value={displayJumuiya}
            onChange={(e) => setManualJumuiya(e.target.value)}
            placeholder="Mfano: Mt. Yosefu"
            disabled={!noOfferingNumber}
            readOnly={!noOfferingNumber && Boolean(lookup)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pledge-date">Tarehe</Label>
          <Input
            id="pledge-date"
            type="date"
            value={pledgeDate}
            onChange={(e) => setPledgeDate(e.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pledge-offering-type">Jina la ahadi / sadaka</Label>
          <select
            id="pledge-offering-type"
            value={offeringTypeName}
            onChange={(e) => setOfferingTypeName(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">Chagua aina ya sadaka…</option>
            {offeringTypes.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label>Kiasi (TZS)</Label>
          <CurrencyInput value={amount} onValueChange={setAmount} placeholder="0" />
        </div>
        <div className="grid gap-2">
          <Label>Paid (TZS)</Label>
          <CurrencyInput value={paidAmount} onValueChange={setPaidAmount} placeholder="0" />
        </div>
      </div>
      <ActionButton type="button" onClick={() => void onSave()} loading={pending} loadingText="Saving…">
        Save / Hifadhi
      </ActionButton>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </div>
  );
}
