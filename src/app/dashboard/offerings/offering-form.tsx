"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createOffering } from "@/lib/actions/offerings";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { parseAmountInput } from "@/lib/format/currency-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Row = { id: string; name?: string; email?: string; phone?: string };

export function OfferingForm({
  types,
  members,
}: {
  types: Row[];
  members: Row[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [typeId, setTypeId] = useState<string>("");
  const [memberId, setMemberId] = useState<string>("__none__");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!typeId && types[0]) setTypeId(types[0].id);
  }, [typeId, types]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const a = parseAmountInput(amount);
    if (!Number.isFinite(a) || a <= 0) {
      setMsg("Enter a valid amount greater than zero.");
      return;
    }
    // React may null out synthetic event fields after an await.
    // Capture the form element synchronously to safely reset later.
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("offering_type_id", typeId);
    fd.set("member_id", memberId === "__none__" ? "" : memberId);
    fd.set("amount", String(a));
    const res = await createOffering(fd);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    form.reset();
    setAmount("");
    setMemberId("__none__");
    if (types[0]) setTypeId(types[0].id);
    setMsg("Offering recorded.");
    router.refresh();
  }

  if (!types.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Record offering</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Record offering</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4 sm:grid-cols-2">
          {msg ? (
            <p className="text-sm text-muted-foreground sm:col-span-2">{msg}</p>
          ) : null}
          <div className="grid gap-2 sm:col-span-2">
            <Label>Type</Label>
            <Select value={typeId} onValueChange={setTypeId} required>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Member (optional)</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Anonymous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Anonymous</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.email || m.phone || m.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount</Label>
            <CurrencyInput
              id="amount"
              value={amount}
              onValueChange={setAmount}
              emptyZero={false}
              aria-required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="received_at">Received at</Label>
            <Input
              id="received_at"
              name="received_at"
              type="datetime-local"
              defaultValue={new Date().toISOString().slice(0, 16)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment_method">Payment method</Label>
            <Input id="payment_method" name="payment_method" placeholder="Cash, card…" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reference">Reference</Label>
            <Input id="reference" name="reference" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Save offering</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
