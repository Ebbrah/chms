"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ORG_AUTH_MODE_LABELS,
  readOrgAuthMode,
  type OrgAuthMode,
} from "@/lib/platform/org-auth-mode";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ParishAuthModeForm({
  settings,
  onSave,
}: {
  settings: unknown;
  onSave: (mode: OrgAuthMode) => Promise<{ error?: string; ok?: boolean }>;
}) {
  const router = useRouter();
  const current = readOrgAuthMode(settings);
  const [mode, setMode] = useState<OrgAuthMode>(current);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await onSave(mode);
    setBusy(false);
    if (res.error) {
      setMsg(res.error);
      return;
    }
    setMsg("Authentication mode updated. Existing member accounts are unchanged.");
    router.refresh();
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="grid max-w-md gap-4">
      <p className="text-sm text-muted-foreground">
        Choose how new members sign up and sign in. Changing this does not delete or reset existing
        accounts — members keep the same profile and roles. For WhatsApp-only mode, ensure member
        phone numbers in profiles match WhatsApp. OTP codes are sent via Meta WhatsApp Cloud API
        (same credentials as Dashboard → WhatsApp).
      </p>
      <div className="grid gap-2">
        <Label htmlFor="auth_mode">Sign-in method</Label>
        <Select value={mode} onValueChange={(v) => setMode(v as OrgAuthMode)}>
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
      </div>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save authentication mode"}
      </Button>
    </form>
  );
}
