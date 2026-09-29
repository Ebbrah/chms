"use client";

import { useMemo, useState } from "react";
import { provisionParish } from "@/lib/actions/platform";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORG_AUTH_MODE_LABELS, type OrgAuthMode } from "@/lib/platform/org-auth-mode";

type Diocese = { id: string; name: string; code: string };
type District = { id: string; diocese_id: string; name: string; code: string };

export function NewParishForm({
  dioceses,
  districts,
}: {
  dioceses: Diocese[];
  districts: District[];
}) {
  const [selectedDiocese, setSelectedDiocese] = useState(dioceses[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState("");

  const filteredDistricts = useMemo(
    () => districts.filter((d) => d.diocese_id === selectedDiocese),
    [districts, selectedDiocese],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    if (logoDataUrl) fd.set("logo_data_url", logoDataUrl);
    try {
      await provisionParish(fd);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to create parish");
      setBusy(false);
    }
  }

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      setLogoDataUrl(result);
      setLogoPreview(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-lg">Provision new parish</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void onSubmit(e)} className="grid gap-4">
          {msg ? <p className="text-sm text-destructive">{msg}</p> : null}

          <div className="grid gap-2">
            <Label htmlFor="diocese">Dayosisi</Label>
            <Select value={selectedDiocese} onValueChange={setSelectedDiocese}>
              <SelectTrigger id="diocese">
                <SelectValue placeholder="Select dayosisi" />
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
            <Label htmlFor="district_id">Jimbo</Label>
            <Select name="district_id" required defaultValue={filteredDistricts[0]?.id}>
              <SelectTrigger id="district_id">
                <SelectValue placeholder="Select jimbo" />
              </SelectTrigger>
              <SelectContent>
                {filteredDistricts.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filteredDistricts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No jimbo in this dayosisi.{" "}
                <a href="/platform/districts/new" className="underline">
                  Add a jimbo first
                </a>
                .
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="display_name">Parish name</Label>
            <Input id="display_name" name="display_name" required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="slug">Join URL slug</Label>
            <Input
              id="slug"
              name="slug"
              placeholder="kanisa-la-mt-maria-dodoma"
              pattern="[a-z0-9-]+"
            />
            <p className="text-xs text-muted-foreground">
              Used for /join/your-slug. Lowercase letters, numbers, hyphens.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="auth_mode">Member authentication</Label>
            <Select name="auth_mode" defaultValue="email">
              <SelectTrigger id="auth_mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ORG_AUTH_MODE_LABELS) as OrgAuthMode[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {ORG_AUTH_MODE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Parishes can change this later without affecting existing accounts.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" name="timezone" defaultValue="Africa/Dar_es_Salaam" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="fiscal_year_start_month">Fiscal year starts (month 1–12)</Label>
            <Input
              id="fiscal_year_start_month"
              name="fiscal_year_start_month"
              type="number"
              min={1}
              max={12}
              defaultValue={1}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="diocese_name">Certificate diocese name (optional)</Label>
            <Input id="diocese_name" name="diocese_name" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="postal_box">Postal box (optional)</Label>
            <Input id="postal_box" name="postal_box" placeholder="P.O.Box 123" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="first_admin_email">First parish admin email (optional)</Label>
            <Input
              id="first_admin_email"
              name="first_admin_email"
              type="email"
              placeholder="admin@parish.org"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="logo">Parish logo (optional)</Label>
            <Input id="logo" type="file" accept="image/*" onChange={onLogoChange} />
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo preview" className="h-16 w-16 rounded object-cover" />
            ) : null}
          </div>

          <Button type="submit" disabled={busy || filteredDistricts.length === 0}>
            {busy ? "Provisioning…" : "Create parish"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
