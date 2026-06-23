import Link from "next/link";
import type { ParishBranding } from "@/lib/platform/parish-branding";
import { ThemeToggle } from "./theme-toggle";
import { SignOutButton } from "./sign-out-button";

export type DashboardHeaderProps = {
  displayName: string;
  showPlatform: boolean;
  showRegional: boolean;
  parish: ParishBranding | null;
};

/** Sync server header — data is loaded in dashboard layout to avoid RSC boundary issues. */
export function DashboardHeader({
  displayName,
  showPlatform,
  showRegional,
  parish,
}: DashboardHeaderProps) {
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
