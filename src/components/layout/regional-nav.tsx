"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NavigationProgressProvider,
  useNavProgress,
} from "@/components/layout/navigation-progress";

function RegionalNavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  const { startNavigation, pendingHref } = useNavProgress();
  const pending = pendingHref === href;

  return (
    <Link
      href={href}
      prefetch={true}
      aria-current={active ? "page" : undefined}
      onClick={() => startNavigation(href)}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        pending && "opacity-80",
      )}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
      {label}
    </Link>
  );
}

export function RegionalNav({
  basePath,
  showFinance,
  horizontal,
}: {
  basePath: string;
  showFinance: boolean;
  horizontal?: boolean;
}) {
  const pathname = usePathname();
  const links = [
    { href: basePath, label: "Overview", exact: true },
    { href: `${basePath}/demographics`, label: "Demographics" },
    { href: `${basePath}/finance`, label: "Finance totals" },
    { href: `${basePath}/registry`, label: "Registry search" },
  ];
  const visible = showFinance ? links : links.filter((l) => !l.href.endsWith("/finance"));

  return (
    <NavigationProgressProvider>
      <nav
        className={cn(
          "flex gap-1 p-2",
          horizontal ? "min-w-max flex-row flex-nowrap" : "flex-col",
        )}
      >
        {visible.map((link) => {
          const active =
            link.exact === true ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <RegionalNavLink key={link.href} href={link.href} label={link.label} active={active} />
          );
        })}
        {!horizontal ? (
          <Link
            href="/dashboard"
            className="mt-4 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            ← Parish dashboard
          </Link>
        ) : null}
      </nav>
    </NavigationProgressProvider>
  );
}
