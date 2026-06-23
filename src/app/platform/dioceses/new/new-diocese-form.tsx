"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createDiocese } from "@/lib/actions/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NewDioceseForm() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const res = await createDiocese(new FormData(e.currentTarget));
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    router.push("/platform/dioceses");
    router.refresh();
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-lg">Dayosisi details</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
          {msg ? <p className="text-sm text-destructive">{msg}</p> : null}
          <div className="grid gap-2">
            <Label htmlFor="name">Dayosisi name</Label>
            <Input id="name" name="name" required placeholder="Dayosisi ya Dodoma" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" required placeholder="dodoma" />
            <p className="text-xs text-muted-foreground">Lowercase, unique identifier.</p>
          </div>
          <Button type="submit">Create dayosisi</Button>
        </form>
      </CardContent>
    </Card>
  );
}
