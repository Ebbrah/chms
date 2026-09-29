/**
 * Parish-level sign-in / sign-up method stored on organizations.settings.auth_mode.
 * Switching modes does not migrate or delete auth.users rows — only changes which UI paths are offered.
 */
export type OrgAuthMode = "email" | "whatsapp" | "both";

export const ORG_AUTH_MODE_LABELS: Record<OrgAuthMode, string> = {
  email: "Email & password",
  whatsapp: "WhatsApp (OTP)",
  both: "Email or WhatsApp",
};

export function readOrgAuthMode(settings: unknown): OrgAuthMode {
  if (!settings || typeof settings !== "object") return "email";
  const raw = String((settings as Record<string, unknown>).auth_mode ?? "email").toLowerCase();
  if (raw === "whatsapp" || raw === "both") return raw;
  return "email";
}

export function orgAllowsEmailAuth(mode: OrgAuthMode): boolean {
  return mode === "email" || mode === "both";
}

export function orgAllowsWhatsappAuth(mode: OrgAuthMode): boolean {
  return mode === "whatsapp" || mode === "both";
}
