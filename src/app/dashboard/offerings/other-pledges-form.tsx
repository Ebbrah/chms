"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recordMemberOtherPledge, searchMembersByOfferingNumber } from "@/lib/actions/member-pledges";
import {
  OFFERING_BATCH_SLOT_FIRST_SERVICE,
  OFFERING_BATCH_SLOT_MIDWEEK,
  OFFERING_BATCH_SLOT_SECOND_SERVICE,
  offeringBatchSlotLabel,
} from "@/lib/offering/weekly";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { parseAmountInput } from "@/lib/format/currency-input";
import { toDisplayCaps } from "@/lib/format/name";
import { Label } from "@/components/ui/label";

type Hit = {
  memberId: string | null;
  offeringNumber: string;
  fullName: string;
  phone: string;
  source: "member" | "seed";
};

const SEARCH_DEBOUNCE_MS = 350;

export function OtherPledgesForm({
  defaultBatchSlot = OFFERING_BATCH_SLOT_MIDWEEK,
}: {
  defaultBatchSlot?: number;
}) {
  const router = useRouter();
  const [batchSlot, setBatchSlot] = useState(defaultBatchSlot);
  const [noOfferingNumber, setNoOfferingNumber] = useState(false);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [pledgeDate, setPledgeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [manualFullName, setManualFullName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualJumuiya, setManualJumuiya] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [searching, setSearching] = useState(false);
  const [lastSearchQuery, setLastSearchQuery] = useState("");
  const searchSeq = useRef(0);

  useEffect(() => {
    if (noOfferingNumber) {
      setHits([]);
      setLastSearchQuery("");
      setSearching(false);
      return;
    }
    const q = search.trim();
    if (q.length < 1) {
      setHits([]);
      setLastSearchQuery("");
      setSearching(false);
      return;
    }

    const handle = window.setTimeout(() => {
      const seq = ++searchSeq.current;
      setSearching(true);
      setErr(null);
      void (async () => {
        try {
          const res = await searchMembersByOfferingNumber(q);
          if (seq !== searchSeq.current) return;
          if ("error" in res && res.error) {
            setErr(res.error);
            setHits([]);
            setLastSearchQuery(q);
            return;
          }
          setHits("rows" in res ? (res.rows ?? []) : []);
          setLastSearchQuery(q);
        } finally {
          if (seq === searchSeq.current) setSearching(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [search, noOfferingNumber]);

  function pickMember(h: Hit) {
    if (noOfferingNumber) return;
    setSelected(h);
    setHits([]);
    setSearch("");
    setLastSearchQuery("");
    setErr(null);
  }

  async function onSave() {
    setMsg(null);
    setErr(null);
    if (noOfferingNumber) {
      if (!manualFullName.trim()) {
        setErr("Andika jina kamili kwa asiye na namba ya sadaka.");
        return;
      }
    } else if (!selected) {
      setErr("Chagua msharika kwa namba ya sadaka.");
      return;
    }
    setPending(true);
    try {
      const fd = new FormData();
      if (!noOfferingNumber && selected?.memberId) fd.set("member_id", selected.memberId);
      fd.set("pledge_date", pledgeDate);
      fd.set("title", title);
      fd.set("amount", String(parseAmountInput(amount)));
      fd.set("paid_amount", String(parseAmountInput(paidAmount)));
      fd.set("full_name", noOfferingNumber ? manualFullName.trim() : selected?.fullName?.trim() || "");
      fd.set("phone_number", noOfferingNumber ? manualPhone.trim() : selected?.phone?.trim() || "");
      fd.set("jumuiya_name", noOfferingNumber ? manualJumuiya.trim() : "");
      fd.set("batch_slot", String(batchSlot));
      const res = await recordMemberOtherPledge(fd);
      if ("error" in res && res.error) {
        setErr(res.error);
        return;
      }
      setMsg("Ahadi nyingine imehifadhiwa.");
      setTitle("");
      setAmount("");
      setPaidAmount("");
      setSelected(null);
      setManualFullName("");
      setManualPhone("");
      setManualJumuiya("");
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
              setSelected(null);
              setSearch("");
              setHits([]);
              setLastSearchQuery("");
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
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pledge-search-offering">Namba ya msharika / asiye sajiliwa</Label>
          <Input
            id="pledge-search-offering"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Andika namba… (tafuta kiotomatiki)"
            autoComplete="off"
            disabled={noOfferingNumber}
          />
          {searching ? <p className="text-xs text-muted-foreground">Inatafuta…</p> : null}
          {lastSearchQuery && !searching && hits.length === 0 && !err && search.trim() === lastSearchQuery ? (
            <p className="text-sm text-muted-foreground">
              Hakuna msharika aliyepatikana kwa &quot;{lastSearchQuery}&quot;.
            </p>
          ) : null}
          {hits.length > 0 ? (
            <div className="max-h-40 overflow-y-auto rounded-md border p-2 text-sm">
              {hits.map((h) => (
                <button
                  key={h.memberId}
                  type="button"
                  className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-muted ${
                    selected?.memberId === h.memberId ? "bg-muted font-medium" : ""
                  }`}
                  onClick={() => pickMember(h)}
                  disabled={noOfferingNumber}
                >
                  <span>
                      <span className="font-mono">{h.offeringNumber}</span> — {toDisplayCaps(h.fullName)}
                  </span>
                  <Badge variant={h.source === "member" ? "secondary" : "outline"}>
                    {h.source === "member" ? "Registered" : "Unregistered"}
                  </Badge>
                </button>
              ))}
            </div>
          ) : null}
          {selected ? (
            <p className="text-sm text-foreground">
              Mteuliwa: <span className="font-medium">{toDisplayCaps(selected.fullName)}</span>{" "}
              <span className="font-mono text-muted-foreground">({selected.offeringNumber})</span>
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label>Jina kamili (asiye sajiliwa)</Label>
          <Input
            value={manualFullName}
            onChange={(e) => setManualFullName(e.target.value)}
            placeholder="Mfano: Juma Peter"
            disabled={!noOfferingNumber}
          />
        </div>
        <div className="grid gap-2">
          <Label>Simu</Label>
          <Input
            value={manualPhone}
            onChange={(e) => setManualPhone(e.target.value)}
            placeholder="07..."
            disabled={!noOfferingNumber}
          />
        </div>
        <div className="grid gap-2">
          <Label>Jumuiya</Label>
          <Input
            value={manualJumuiya}
            onChange={(e) => setManualJumuiya(e.target.value)}
            placeholder="Mfano: Mt. Yosefu"
            disabled={!noOfferingNumber}
          />
        </div>
        <div className="grid gap-2">
          <Label>Tarehe</Label>
          <Input type="date" value={pledgeDate} onChange={(e) => setPledgeDate(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Jina la ahadi / sadaka</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kwa mfano: Ujenzi…" />
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
      <Button type="button" onClick={() => void onSave()} disabled={pending}>
        {pending ? "Inahifadhi…" : "Hifadhi ahadi"}
      </Button>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </div>
  );
}
