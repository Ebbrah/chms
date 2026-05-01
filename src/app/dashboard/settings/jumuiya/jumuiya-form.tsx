"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createJumuiya } from "@/lib/actions/admin-setup";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChairpersonOption = { id: string; full_name: string | null };

export function JumuiyaForm({ chairpersonOptions }: { chairpersonOptions: ChairpersonOption[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const res = await createJumuiya(fd);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    e.currentTarget.reset();
    setMsg("Jumuiya created.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create jumuiya</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="flex flex-wrap items-end gap-4">
          {msg ? <p className="w-full text-sm text-muted-foreground">{msg}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="jumuiya-name">Jumuiya name</Label>
            <Input id="jumuiya-name" name="name" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="jumuiya-chairperson">Mwenyekiti wa Jumuiya</Label>
            <Select name="chairperson_user_id" defaultValue="__none__">
              <SelectTrigger id="jumuiya-chairperson">
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
          <Button type="submit">Create</Button>
        </form>
      </CardContent>
    </Card>
  );
}
