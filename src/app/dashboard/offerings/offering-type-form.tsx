"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createOfferingType } from "@/lib/actions/offerings";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OfferingTypeForm() {
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
      const res = await createOfferingType(fd);
      if ("error" in res && res.error) {
        setMsg(res.error);
        return;
      }
      form.reset();
      setMsg("Type added.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Offering type</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-wrap items-end gap-4">
          {msg ? <p className="w-full text-sm text-muted-foreground">{msg}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="ot-name">Name</Label>
            <Input id="ot-name" name="name" required />
          </div>
          <SubmitButton loading={submitting} loadingText="Adding…">
            Add type
          </SubmitButton>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/offerings/types">View</Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
