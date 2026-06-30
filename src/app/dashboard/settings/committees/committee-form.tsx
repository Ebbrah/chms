"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCommittee } from "@/lib/actions/admin-setup";
import { SubmitButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ChairpersonOption = { id: string; full_name: string | null };

export function CommitteeForm({ chairpersonOptions }: { chairpersonOptions: ChairpersonOption[] }) {
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
      const res = await createCommittee(fd);
      if ("error" in res && res.error) {
        setMsg(res.error);
        return;
      }
      form.reset();
      setMsg("Committee created.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create committee</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-wrap items-end gap-4">
          {msg ? <p className="w-full text-sm text-muted-foreground">{msg}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="committee-name">Committee name</Label>
            <Input id="committee-name" name="name" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="committee-chairperson">Mwenyekiti wa Kamati</Label>
            <Select name="chairperson_user_id" defaultValue="__none__">
              <SelectTrigger id="committee-chairperson">
                <SelectValue placeholder="Chagua mwenyekiti" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Hakuna</SelectItem>
                {chairpersonOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ?? p.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SubmitButton loading={submitting} loadingText="Creating…">
            Create
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
