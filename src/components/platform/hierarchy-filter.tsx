"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Diocese = { id: string; name: string };
type District = { id: string; name: string; diocese_id: string };

export function HierarchyFilter({
  dioceses,
  districts,
  showDistrict = true,
}: {
  dioceses: Diocese[];
  districts: District[];
  showDistrict?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dioceseId = searchParams.get("diocese") ?? "";
  const districtId = searchParams.get("district") ?? "";

  const filteredDistricts = dioceseId
    ? districts.filter((d) => d.diocese_id === dioceseId)
    : districts;

  function updateParams(next: { diocese?: string; district?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if ("diocese" in next) {
      if (next.diocese) params.set("diocese", next.diocese);
      else params.delete("diocese");
      params.delete("district");
    }
    if ("district" in next) {
      if (next.district) params.set("district", next.district);
      else params.delete("district");
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="grid gap-2">
        <Label htmlFor="filter-diocese">Dayosisi</Label>
        <Select
          value={dioceseId || "__all__"}
          onValueChange={(v) => updateParams({ diocese: v === "__all__" ? "" : v })}
        >
          <SelectTrigger id="filter-diocese" className="w-[220px]">
            <SelectValue placeholder="All dayosisi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All dayosisi</SelectItem>
            {dioceses.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showDistrict ? (
        <div className="grid gap-2">
          <Label htmlFor="filter-district">Jimbo</Label>
          <Select
            value={districtId || "__all__"}
            onValueChange={(v) => updateParams({ district: v === "__all__" ? "" : v })}
          >
            <SelectTrigger id="filter-district" className="w-[220px]">
              <SelectValue placeholder="All jimbo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All jimbo</SelectItem>
              {filteredDistricts.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
