"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { broadcastParishWhatsapp, sendParishWhatsapp } from "@/lib/actions/whatsapp-messaging";
import { SubmitButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function WhatsappSection({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [singleSubmitting, setSingleSubmitting] = useState(false);
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);

  async function onSendSingle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (singleSubmitting) return;
    setMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSingleSubmitting(true);
    try {
      const res = await sendParishWhatsapp(fd);
      if ("error" in res && res.error) setMsg(res.error);
      else {
        setMsg("Message sent.");
        form.reset();
        router.refresh();
      }
    } finally {
      setSingleSubmitting(false);
    }
  }

  async function onBroadcast(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (broadcastSubmitting) return;
    setMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBroadcastSubmitting(true);
    try {
      const res = await broadcastParishWhatsapp(fd);
      if ("error" in res && res.error) setMsg(res.error);
      else if ("ok" in res && res.ok) {
        const detail =
          res.failed > 0 && res.errors?.length
            ? ` Errors: ${res.errors.join("; ")}`
            : "";
        setMsg(
          `Broadcast finished: ${res.sent} sent, ${res.failed} failed (${res.total} recipients).${detail}`,
        );
        form.reset();
        router.refresh();
      }
    } finally {
      setBroadcastSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {!configured ? (
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Meta WhatsApp not configured</CardTitle>
            <CardDescription>
              Set <code className="rounded bg-muted px-1">META_WHATSAPP_ACCESS_TOKEN</code> and{" "}
              <code className="rounded bg-muted px-1">META_WHATSAPP_PHONE_NUMBER_ID</code> on the
              server. Member sign-in OTP uses the same credentials.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send to one number</CardTitle>
          <CardDescription>E.164 format, e.g. +255712345678</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onSendSingle(e)} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="wa-to">Phone</Label>
              <Input id="wa-to" name="to" placeholder="+255712345678" required disabled={!configured} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wa-body-single">Message</Label>
              <Textarea id="wa-body-single" name="body" rows={4} required disabled={!configured} />
            </div>
            <SubmitButton loading={singleSubmitting} loadingText="Sending…" disabled={!configured}>
              Send WhatsApp
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Broadcast to parish</CardTitle>
          <CardDescription>
            Sends to every unique phone on active members and profiles in your parish. Meta may
            require an approved message template for numbers outside the 24-hour window.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void onBroadcast(e)} className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="wa-body-broadcast">Message</Label>
              <Textarea
                id="wa-body-broadcast"
                name="body"
                rows={5}
                required
                disabled={!configured}
                placeholder="Announcement for all members…"
              />
            </div>
            <SubmitButton
              loading={broadcastSubmitting}
              loadingText="Sending to all…"
              disabled={!configured}
            >
              Send to all members
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      {msg ? (
        <p className="text-sm text-muted-foreground lg:col-span-2">{msg}</p>
      ) : null}
    </div>
  );
}
