import type { AppRole } from "./roles";

export function hasRole(roles: AppRole[], r: AppRole) {
  return roles.includes(r);
}

export function isAdmin(roles: AppRole[]) {
  return hasRole(roles, "admin");
}

export function canFinance(roles: AppRole[]) {
  return hasRole(roles, "admin") || hasRole(roles, "treasurer");
}

export function canManageCommitteeBudget(roles: AppRole[]) {
  return canFinance(roles) || hasRole(roles, "committee_head");
}

export function canPastoral(roles: AppRole[]) {
  return (
    hasRole(roles, "admin") ||
    hasRole(roles, "treasurer") ||
    hasRole(roles, "pastor") ||
    hasRole(roles, "assistant_pastor")
  );
}

export function canManageMembers(roles: AppRole[]) {
  return canFinance(roles);
}

export function canManageTravelCertificates(roles: AppRole[]) {
  return (
    hasRole(roles, "admin") ||
    hasRole(roles, "treasurer") ||
    hasRole(roles, "pastor") ||
    hasRole(roles, "assistant_pastor") ||
    hasRole(roles, "evangelist")
  );
}

export function canIssueTravelCertificates(roles: AppRole[]) {
  return hasRole(roles, "pastor") || hasRole(roles, "evangelist");
}

export function canManageOfferings(roles: AppRole[]) {
  return (
    hasRole(roles, "admin") ||
    hasRole(roles, "treasurer") ||
    hasRole(roles, "committee_head") ||
    hasRole(roles, "church_elder")
  );
}

export function canManageRoles(roles: AppRole[]) {
  return isAdmin(roles);
}

export function canViewJumuiyaReports(roles: AppRole[]) {
  return canPastoral(roles) || hasRole(roles, "jumuiya_chairman");
}

/** UI hint: finance always; committee_head may access if they head Planning (checked server-side). */
export function canViewOfferingReportsNav(roles: AppRole[]) {
  return canFinance(roles) || hasRole(roles, "committee_head");
}

export function canApproveOfferingBatch(roles: AppRole[]) {
  return hasRole(roles, "treasurer") || isAdmin(roles);
}

export function canAuthorizeOfferingBatch(roles: AppRole[]) {
  return hasRole(roles, "committee_head") || isAdmin(roles);
}

export function canRecordWeeklyOfferings(roles: AppRole[]) {
  return (
    hasRole(roles, "admin") ||
    hasRole(roles, "committee_head") ||
    hasRole(roles, "church_elder")
  );
}

/** Mid-week / collective offerings and treasurer-recorded batches (batch slot 2). */
export function canRecordMidWeekOfferings(roles: AppRole[]) {
  return (
    hasRole(roles, "admin") ||
    hasRole(roles, "treasurer") ||
    hasRole(roles, "committee_head")
  );
}

export function canEditPendingOfferings(roles: AppRole[]) {
  return canRecordWeeklyOfferings(roles);
}
