"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NavigationProgressProvider,
  useNavProgress,
} from "@/components/layout/navigation-progress";

const links = [
  { href: "/platform", label: "Overview", exact: true },
  { href: "/platform/dioceses", label: "Dayosisi" },
  { href: "/platform/districts", label: "Jimbo" },
  { href: "/platform/parishes", label: "Parishes" },
  { href: "/platform/transfers", label: "Transfers" },
];

function PlatformNavLink({
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

export function PlatformNav() {
  const pathname = usePathname();

  return (
    <NavigationProgressProvider>
      <nav className="flex flex-col gap-1 p-2">
        {links.map((link) => {
          const active =
            link.exact === true ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <PlatformNavLink key={link.href} href={link.href} label={link.label} active={active} />
          );
        })}
        <Link
          href="/dashboard"
          className="mt-4 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          ← Parish dashboard
        </Link>
      </nav>
    </NavigationProgressProvider>
  );
}
