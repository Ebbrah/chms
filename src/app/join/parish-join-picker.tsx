"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ParishJoinOptions } from "@/lib/platform/parish-join-options";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ParishJoinPicker({ options }: { options: ParishJoinOptions }) {
  const router = useRouter();
  const [dioceseId, setDioceseId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [parishSlug, setParishSlug] = useState("");

  const districts = useMemo(
    () =>
      dioceseId
        ? options.districts.filter((d) => d.diocese_id === dioceseId)
        : options.districts,
    [dioceseId, options.districts],
  );

  const parishes = useMemo(
    () =>
      districtId
        ? options.parishes.filter((p) => p.district_id === districtId)
        : [],
    [districtId, options.parishes],
  );

  const selectedParish = options.parishes.find((p) => p.slug === parishSlug);

  function onDioceseChange(value: string) {
    setDioceseId(value);
    setDistrictId("");
    setParishSlug("");
  }

  function onDistrictChange(value: string) {
    setDistrictId(value);
    setParishSlug("");
  }

  function onRegister() {
    if (!selectedParish?.slug) return;
    router.push(`/join/${selectedParish.slug}`);
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="join-diocese">Dayosisi</Label>
        <Select value={dioceseId || undefined} onValueChange={onDioceseChange}>
          <SelectTrigger id="join-diocese">
            <SelectValue placeholder="Chagua dayosisi" />
          </SelectTrigger>
          <SelectContent>
            {options.dioceses.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="join-district">Jimbo</Label>
        <Select
          value={districtId || undefined}
          onValueChange={onDistrictChange}
          disabled={!dioceseId}
        >
          <SelectTrigger id="join-district">
            <SelectValue placeholder={dioceseId ? "Chagua jimbo" : "Chagua dayosisi kwanza"} />
          </SelectTrigger>
          <SelectContent>
            {districts.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="join-parish">Usharika</Label>
        <Select
          value={parishSlug || undefined}
          onValueChange={setParishSlug}
          disabled={!districtId}
        >
          <SelectTrigger id="join-parish">
            <SelectValue placeholder={districtId ? "Chagua usharika" : "Chagua jimbo kwanza"} />
          </SelectTrigger>
          <SelectContent>
            {parishes.map((p) => (
              <SelectItem key={p.id} value={p.slug}>
                {p.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedParish ? (
        <p className="text-sm text-muted-foreground">
          Utajisajili kwa:{" "}
          <span className="font-medium text-foreground">{selectedParish.display_name}</span>
        </p>
      ) : null}

      <Button type="button" disabled={!selectedParish} onClick={onRegister}>
        Jisajili na Usharika
      </Button>
    </div>
  );
}
