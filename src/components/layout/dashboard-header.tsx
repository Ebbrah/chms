import Link from "next/link";
import { canAccessPlatform } from "@/lib/auth/platform-guard";
import { getRegionalScope } from "@/lib/auth/regional-guard";
import { getProfile, getSessionUser } from "@/lib/auth/session";
import { getCurrentParishBranding } from "@/lib/platform/parish-branding";
import { ThemeToggle } from "./theme-toggle";
import { SignOutButton } from "./sign-out-button";

/** Self-loading server header — avoids passing auth/branding props across RSC boundaries. */
export async function DashboardHeader() {
  const [user, parish, showPlatform, regionalScope, profile] = await Promise.all([
    getSessionUser().catch(() => null),
    getCurrentParishBranding().catch(() => null),
    canAccessPlatform().catch(() => false),
    getRegionalScope().catch(() => null),
    getProfile().catch(() => null),
  ]);

  const fullName = String(profile?.full_name ?? "").trim();
  const fallbackName = String(user?.user_metadata?.full_name ?? "").trim();
  const displayName = fullName || fallbackName || "Member";

  const showRegional = regionalScope !== null;
  const regionalHref =
    regionalScope?.type === "district" ? "/regional/district" : "/regional/diocese";

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
        {showRegional ? (
          <Link
            href={regionalHref}
            className="text-xs font-medium text-primary hover:underline"
          >
            Regional
          </Link>
        ) : null}
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
