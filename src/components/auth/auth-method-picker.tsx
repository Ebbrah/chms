"use client";

import type { OrgAuthMode } from "@/lib/platform/org-auth-mode";
import { orgAllowsEmailAuth, orgAllowsWhatsappAuth } from "@/lib/platform/org-auth-mode";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AuthMethod = "email" | "whatsapp";

export function AuthMethodPicker({
  mode,
  value,
  onChange,
  className,
}: {
  mode: OrgAuthMode;
  value: AuthMethod;
  onChange: (m: AuthMethod) => void;
  className?: string;
}) {
  const showEmail = orgAllowsEmailAuth(mode);
  const showWhatsapp = orgAllowsWhatsappAuth(mode);

  if (showEmail && !showWhatsapp) return null;
  if (!showEmail && showWhatsapp) return null;

  return (
    <div className={cn("flex rounded-lg border p-1", className)}>
      {showEmail ? (
        <Button
          type="button"
          variant={value === "email" ? "default" : "ghost"}
          size="sm"
          className="flex-1"
          onClick={() => onChange("email")}
        >
          Email
        </Button>
      ) : null}
      {showWhatsapp ? (
        <Button
          type="button"
          variant={value === "whatsapp" ? "default" : "ghost"}
          size="sm"
          className="flex-1"
          onClick={() => onChange("whatsapp")}
        >
          WhatsApp
        </Button>
      ) : null}
    </div>
  );
}
