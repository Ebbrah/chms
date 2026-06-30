"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMember } from "@/lib/actions/members";
import { SubmitButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function MemberCreateForm() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSubmitting(true);
    try {
      const res = await createMember(fd);
      if ("error" in res && res.error) {
        setMsg(res.error);
        return;
      }
      form.reset();
      setMsg("Member created.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Add member</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4 sm:grid-cols-2">
          {msg ? (
            <p className="text-sm text-muted-foreground sm:col-span-2">{msg}</p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="m-email">Email</Label>
            <Input id="m-email" name="email" type="email" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="m-phone">Phone</Label>
            <Input id="m-phone" name="phone" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="m-address">Address</Label>
            <Input id="m-address" name="address" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="m-notes">Notes</Label>
            <Textarea id="m-notes" name="notes" rows={2} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="m-pastoral">Pastoral notes</Label>
            <Textarea id="m-pastoral" name="pastoral_notes" rows={2} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="m-status">Status</Label>
            <Input id="m-status" name="status" defaultValue="active" />
          </div>
          <div className="flex items-end">
            <SubmitButton loading={submitting} loadingText="Saving…">
              Save member
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
