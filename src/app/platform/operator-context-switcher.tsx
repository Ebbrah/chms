"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setOperatorContext } from "@/lib/actions/platform";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ParishOption = {
  id: string;
  display_name: string | null;
  slug: string | null;
  status: string | null;
};

export function OperatorContextSwitcher({ parishes }: { parishes: ParishOption[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const active = parishes.filter((p) => p.status === "active");

  async function onSwitch(value: string) {
    setMsg(null);
    const orgId = value === "__home__" ? null : value;
    const res = await setOperatorContext(orgId);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setMsg(orgId ? "Switched parish context." : "Using your home parish.");
    router.refresh();
  }

  if (active.length === 0) return null;

  return (
    <div className="grid gap-2">
      <Label htmlFor="operator-context">Operate as parish</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Select onValueChange={(v) => void onSwitch(v)}>
          <SelectTrigger id="operator-context" className="w-[240px]">
            <SelectValue placeholder="Select parish context" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__home__">My home parish</SelectItem>
            {active.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.display_name ?? p.slug ?? p.id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={() => void onSwitch("__home__")}>
          Reset
        </Button>
      </div>
      {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
