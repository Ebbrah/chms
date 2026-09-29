"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  assignParishOperator,
  removeParishOperator,
  setParishStatus,
  updateParishAuthMode,
  updateParishFeatures,
  updateParishLogo,
} from "@/lib/actions/platform";
import { ParishAuthModeForm } from "@/components/settings/parish-auth-mode-form";
import {
  DEFAULT_ORG_FEATURES,
  type OrgFeatureKey,
  readOrgFeatureFlags,
} from "@/lib/platform/org-features";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const FEATURE_LABELS: Record<OrgFeatureKey, string> = {
  module_offerings: "Offerings module",
  module_finance: "Finance module",
  module_payroll: "Payroll module",
  module_travel_certificates: "Travel certificates",
  module_sms: "SMS module",
  offerings_mpesa: "M-Pesa offerings",
  member_import: "Member import",
};

type OperatorRow = {
  id: string;
  user_id: string;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

export function ParishDetailClient({
  orgId,
  slug,
  status,
  settings,
  operators,
  created,
}: {
  orgId: string;
  slug: string | null;
  status: string;
  settings: unknown;
  operators: OperatorRow[];
  created?: boolean;
}) {
  const router = useRouter();
  const flags = readOrgFeatureFlags(settings);
  const [msg, setMsg] = useState<string | null>(null);
  const [operatorEmail, setOperatorEmail] = useState("");
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://your-chms-domain";

  async function onToggleFeature(key: OrgFeatureKey, checked: boolean) {
    setMsg(null);
    const res = await updateParishFeatures(orgId, { [key]: checked });
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    router.refresh();
  }

  async function onStatus(next: "active" | "suspended") {
    setMsg(null);
    const res = await setParishStatus(orgId, next);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    router.refresh();
  }

  async function onAssignOperator(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await assignParishOperator(orgId, operatorEmail);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    setOperatorEmail("");
    router.refresh();
  }

  async function onRemoveOperator(userId: string) {
    setMsg(null);
    const res = await removeParishOperator(orgId, userId);
    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }
    router.refresh();
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const fd = new FormData();
      fd.set("logo_data_url", String(reader.result ?? ""));
      const res = await updateParishLogo(orgId, fd);
      if ("error" in res && res.error) setMsg(res.error);
      else router.refresh();
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {created ? (
        <Card className="lg:col-span-2 border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm">
              Parish created. Join link (MT-3):{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                {baseUrl}/join/{slug ?? "your-slug"}
              </code>
            </p>
          </CardContent>
        </Card>
      ) : null}

      {msg ? <p className="lg:col-span-2 text-sm text-destructive">{msg}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Current:</span>
            <Badge variant={status === "active" ? "default" : "destructive"}>{status}</Badge>
          </div>
          {status === "active" ? (
            <Button variant="destructive" onClick={() => void onStatus("suspended")}>
              Suspend parish
            </Button>
          ) : (
            <Button onClick={() => void onStatus("active")}>Reactivate parish</Button>
          )}
          <p className="text-xs text-muted-foreground">
            Suspended parishes block login for parish users. Platform admin can still access.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Logo</CardTitle>
        </CardHeader>
        <CardContent>
          <Input type="file" accept="image/*" onChange={onLogoChange} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Member authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <ParishAuthModeForm
            settings={settings}
            onSave={(mode) => updateParishAuthMode(orgId, mode)}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Feature flags</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(DEFAULT_ORG_FEATURES) as OrgFeatureKey[]).map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={flags[key] === true}
                onCheckedChange={(v) => void onToggleFeature(key, v === true)}
              />
              {FEATURE_LABELS[key]}
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Parish operators</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(e) => void onAssignOperator(e)} className="flex flex-wrap gap-2">
            <Input
              type="email"
              placeholder="team-member@example.com"
              value={operatorEmail}
              onChange={(e) => setOperatorEmail(e.target.value)}
              required
            />
            <Button type="submit">Assign operator</Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {operators.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No operators assigned.
                  </TableCell>
                </TableRow>
              ) : (
                operators.map((op) => (
                  <TableRow key={op.id}>
                    <TableCell>{op.profiles?.full_name ?? "—"}</TableCell>
                    <TableCell>{op.profiles?.email ?? op.user_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void onRemoveOperator(op.user_id)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
