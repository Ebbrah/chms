import Link from "next/link";
import { getSessionUser, getProfile } from "@/lib/auth/session";
import { getCurrentParishBranding } from "@/lib/platform/parish-branding";
import { canAccessPlatform } from "@/lib/auth/platform-guard";
import { canAccessRegional } from "@/lib/auth/regional-guard";
import { ThemeToggle } from "./theme-toggle";
import { SignOutButton } from "./sign-out-button";

export async function DashboardHeader() {
  const user = await getSessionUser();
  const profile = user ? await getProfile() : null;
  const fullName = String(profile?.full_name ?? "").trim();
  const fallbackName = String(user?.user_metadata?.full_name ?? "").trim();
  const displayName = fullName || fallbackName || "Member";

  let showPlatform = false;
  let showRegional = false;
  let parish: Awaited<ReturnType<typeof getCurrentParishBranding>> = null;

  if (user) {
    try {
      [showPlatform, showRegional, parish] = await Promise.all([
        canAccessPlatform(),
        canAccessRegional(),
        getCurrentParishBranding(),
      ]);
    } catch {
      /* MT tables may lag behind app deploy — parish dashboard must still load. */
      parish = await getCurrentParishBranding().catch(() => null);
    }
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
        {showRegional ? (
          <Link
            href="/regional"
            className="text-xs font-medium text-primary hover:underline"
          >
            Dayosisi / Jimbo
          </Link>
        ) : null}
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
