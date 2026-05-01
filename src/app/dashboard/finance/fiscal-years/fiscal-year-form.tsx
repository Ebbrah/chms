"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createFiscalYear } from "@/lib/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FiscalYearForm() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const res = await createFiscalYear(fd);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    e.currentTarget.reset();
    setMsg("Fiscal year added.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">New fiscal year</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-wrap items-end gap-4">
          {msg ? <p className="w-full text-sm text-muted-foreground">{msg}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="label">Label</Label>
            <Input id="label" name="label" placeholder="FY 2026" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="start_date">Start</Label>
            <Input id="start_date" name="start_date" type="date" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="end_date">End</Label>
            <Input id="end_date" name="end_date" type="date" required />
          </div>
          <Button type="submit">Add</Button>
        </form>
      </CardContent>
    </Card>
  );
}
