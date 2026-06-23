"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { transferParishMember } from "@/lib/actions/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ParishOption = { id: string; display_name: string | null; name: string };

export function TransferMemberForm({ parishes }: { parishes: ParishOption[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const toOrgId = String(fd.get("to_org_id") ?? "");
    const reason = String(fd.get("reason") ?? "");
    const res = await transferParishMember(email, toOrgId, reason);
    if ("error" in res && res.error) {
      setError(res.error);
      return;
    }
    if ("ok" in res && res.ok) {
      setMsg(`Transferred ${"userName" in res ? res.userName ?? "member" : "member"} successfully.`);
    }
    e.currentTarget.reset();
    router.refresh();
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-lg">Transfer member to parish</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="email">Member email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="to_org_id">Target parish</Label>
            <Select name="to_org_id" required>
              <SelectTrigger id="to_org_id">
                <SelectValue placeholder="Select parish" />
              </SelectTrigger>
              <SelectContent>
                {parishes.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name ?? p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea id="reason" name="reason" rows={2} />
          </div>
          <p className="text-xs text-muted-foreground">
            Closes access at the old parish, deactivates the old membership, and assigns the
            member role at the new parish. One email — one parish at a time.
          </p>
          <Button type="submit">Transfer</Button>
        </form>
      </CardContent>
    </Card>
  );
}
