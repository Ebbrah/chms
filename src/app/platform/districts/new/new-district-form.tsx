"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createDistrict } from "@/lib/actions/platform";
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

type Diocese = { id: string; name: string };

export function NewDistrictForm({
  dioceses,
  defaultDioceseId,
}: {
  dioceses: Diocese[];
  defaultDioceseId?: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [dioceseId, setDioceseId] = useState(defaultDioceseId ?? dioceses[0]?.id ?? "");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.set("diocese_id", dioceseId);
    const res = await createDistrict(fd);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    router.push("/platform/districts");
    router.refresh();
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-lg">Jimbo details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
          {msg ? <p className="text-sm text-destructive">{msg}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="diocese_id">Dayosisi</Label>
            <Select value={dioceseId} onValueChange={setDioceseId} required>
              <SelectTrigger id="diocese_id">
                <SelectValue placeholder="Select diocese" />
              </SelectTrigger>
              <SelectContent>
                {dioceses.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">Jimbo name</Label>
            <Input id="name" name="name" required placeholder="Jimbo Kuu la Dodoma" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" required placeholder="dodoma-central" />
          </div>
          <Button type="submit">Create district</Button>
        </form>
      </CardContent>
    </Card>
  );
}
