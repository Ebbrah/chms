"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth/roles";
import {
  canFinance,
  canManageOfferings,
  canManageCommitteeBudget,
  canManageMembers,
  canManageRoles,
  canViewJumuiyaReports,
  canViewOfferingReportsNav,
  canManageTravelCertificates,
  hasRole,
} from "@/lib/auth/permissions";
import { getChurchTimeZone } from "@/lib/offering/church-calendar";

const links: {
  href: string;
  label: string;
  visible: (r: AppRole[], isSunday: boolean) => boolean;
}[] = [
  { href: "/dashboard", label: "Home", visible: () => true },
  {
    href: "/dashboard/members",
    label: "Members",
    visible: (r) => canManageMembers(r),
  },
  {
    href: "/dashboard/offerings",
    label: "Offerings",
    visible: (r, isSunday) => {
      const isChurchElderOnly =
        hasRole(r, "church_elder") &&
        !hasRole(r, "admin") &&
        !hasRole(r, "treasurer") &&
        !hasRole(r, "committee_head");
      if (isChurchElderOnly && !isSunday) return false;
      return canManageOfferings(r);
    },
  },
  {
    href: "/dashboard/my-offerings",
    label: "My offerings",
    visible: () => true,
  },
  {
    href: "/dashboard/my-profile",
    label: "My profile report",
    visible: () => true,
  },
  {
    href: "/dashboard/change-password",
    label: "Change password",
    visible: () => true,
  },
  {
    href: "/dashboard/travel-certificates",
    label: "Travel certificates",
    visible: (r) => canManageTravelCertificates(r) || hasRole(r, "member"),
  },
  {
    href: "/dashboard/offerings/reports",
    label: "Offering reports",
    visible: (r) => canViewOfferingReportsNav(r),
  },
  {
    href: "/dashboard/finance/accounts",
    label: "Accounts",
    visible: (r) => canFinance(r),
  },
  {
    href: "/dashboard/finance/fiscal-years",
    label: "Fiscal years",
    visible: (r) => canFinance(r),
  },
  {
    href: "/dashboard/finance/budget",
    label: "Budget",
    visible: (r) => canManageCommitteeBudget(r),
  },
  {
    href: "/dashboard/finance/ledger",
    label: "Ledger",
    visible: (r) => canFinance(r),
  },
  {
    href: "/dashboard/finance/cashbook",
    label: "Cashbook",
    visible: (r) => canFinance(r),
  },
  {
    href: "/dashboard/finance/payroll",
    label: "Payroll",
    visible: (r) => canFinance(r),
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    visible: (r) => canViewJumuiyaReports(r),
  },
  {
    href: "/dashboard/settings/roles",
    label: "Roles",
    visible: (r) => canManageRoles(r),
  },
  {
    href: "/dashboard/settings/committees",
    label: "Committees",
    visible: (r) => canManageRoles(r),
  },
  {
    href: "/dashboard/settings/jumuiya",
    label: "Jumuiya",
    visible: (r) => canManageRoles(r),
  },
  {
    href: "/dashboard/settings/sms",
    label: "SMS",
    visible: (r) => canManageRoles(r) || canFinance(r),
  },
];

export function DashboardNav({
  roles,
  horizontal,
}: {
  roles: AppRole[];
  horizontal?: boolean;
}) {
  const pathname = usePathname();
  const isSundayInChurchTz =
    new Intl.DateTimeFormat("en-US", {
      timeZone: getChurchTimeZone(),
      weekday: "long",
    }).format(new Date()) === "Sunday";
  return (
    <nav
      className={cn(
        "flex gap-1 p-2",
        horizontal ? "flex-row flex-nowrap" : "flex-col",
      )}
    >
      {links
        .filter((l) => l.visible(roles, isSundayInChurchTz))
        .map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              horizontal && "shrink-0 whitespace-nowrap",
              pathname === l.href && "bg-accent text-accent-foreground",
            )}
          >
            {l.label}
          </Link>
        ))}
    </nav>
  );
}
