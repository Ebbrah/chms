import Link from "next/link";
import { canAccessPlatform } from "@/lib/auth/platform-guard";
import { getProfile, getSessionUser } from "@/lib/auth/session";
import { getCurrentParishBranding } from "@/lib/platform/parish-branding";
import { ThemeToggle } from "./theme-toggle";
import { SignOutButton } from "./sign-out-button";

/** Self-loading server header — avoids passing auth/branding props across RSC boundaries. */
export async function DashboardHeader() {
  let displayName = "Member";
  let parish: Awaited<ReturnType<typeof getCurrentParishBranding>> = null;
  let showPlatform = false;

  try {
    const user = await getSessionUser();
    if (user) {
      const profile = await getProfile();
      const fullName = String(profile?.full_name ?? "").trim();
      const fallbackName = String(user.user_metadata?.full_name ?? "").trim();
      displayName = fullName || fallbackName || "Member";
    }
  } catch {
    /* Welcome line can fall back to "Member". */
  }

  try {
    parish = await getCurrentParishBranding();
  } catch {
    /* Logo / parish name are optional. */
  }

  try {
    showPlatform = await canAccessPlatform();
  } catch {
    /* Platform link hidden when MT tables lag. */
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {parish?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={parish.logoUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded border object-cover"
          />
        ) : null}
        <div className="min-w-0 text-sm">
          {parish ? (
            <p className="truncate font-medium text-foreground">{parish.displayName}</p>
          ) : null}
          <p className="truncate text-muted-foreground">
            <span className="text-foreground">Welcome</span>{" "}
            <span className="font-medium text-primary">{displayName}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showPlatform ? (
          <Link
            href="/platform"
            className="text-xs font-medium text-primary hover:underline"
          >
            Platform
          </Link>
        ) : null}
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
