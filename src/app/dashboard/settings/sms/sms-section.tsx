"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendChurchSms, updateSmsOptIn } from "@/lib/actions/sms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SmsSection({ smsOptIn }: { smsOptIn: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [optIn, setOptIn] = useState(smsOptIn);

  async function onToggle(checked: boolean) {
    setOptIn(checked);
    const res = await updateSmsOptIn(checked);
    if ("error" in res && res.error) setMsg(res.error);
    else setMsg(checked ? "Opted in to SMS." : "Opted out.");
    router.refresh();
  }

  async function onSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const res = await sendChurchSms(fd);
    if ("error" in res && res.error) setMsg(res.error);
    else {
      setMsg("Sent (or logged if provider failed — check table).");
      e.currentTarget.reset();
      router.refresh();
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your preference</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Checkbox
            id="opt"
            checked={optIn}
            onCheckedChange={(v) => void onToggle(v === true)}
          />
          <Label htmlFor="opt">SMS opt-in</Label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send message</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSend(e)} className="grid gap-3">
            {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
            <div className="grid gap-2">
              <Label htmlFor="to">E.164 phone</Label>
              <Input id="to" name="to" placeholder="+15551234567" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="body">Message</Label>
              <Input id="body" name="body" required />
            </div>
            <Button type="submit">Send</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
