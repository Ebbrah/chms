"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCommittee } from "@/lib/actions/admin-setup";
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

export function EditCommitteeForm({
  id,
  name,
  chairpersonUserId,
  chairpersonOptions,
}: {
  id: string;
  name: string;
  chairpersonUserId: string;
  chairpersonOptions: ChairpersonOption[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", id);
    const res = await updateCommittee(fd);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setMsg("Committee updated.");
    router.push("/dashboard/settings/committees");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Edit committee</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4 sm:max-w-xl">
          {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="committee-name">Committee name</Label>
            <Input id="committee-name" name="name" defaultValue={name} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="committee-chairperson">Mwenyekiti wa Kamati</Label>
            <Select
              name="chairperson_user_id"
              defaultValue={chairpersonUserId.trim() ? chairpersonUserId : "__none__"}
            >
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
          <div className="flex gap-2">
            <Button type="submit">Save changes</Button>
            <Button type="button" variant="outline" onClick={() => router.push("/dashboard/settings/committees")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
