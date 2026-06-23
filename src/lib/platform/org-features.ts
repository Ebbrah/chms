/**
 * Org-level feature flags stored on organizations.settings.features.
 * Platform admin toggles these per parish (MT-2 UI); server actions must re-check.
 */
export type OrgFeatureKey =
  | "module_offerings"
  | "module_finance"
  | "module_payroll"
  | "module_travel_certificates"
  | "module_sms"
  | "offerings_mpesa"
  | "member_import";

export type OrgFeatureFlags = Partial<Record<OrgFeatureKey, boolean>>;

export const DEFAULT_ORG_FEATURES: Required<OrgFeatureFlags> = {
  module_offerings: true,
  module_finance: true,
  module_payroll: true,
  module_travel_certificates: true,
  module_sms: true,
  offerings_mpesa: false,
  member_import: true,
};

export function readOrgFeatureFlags(settings: unknown): OrgFeatureFlags {
  if (!settings || typeof settings !== "object") return { ...DEFAULT_ORG_FEATURES };
  const features = (settings as Record<string, unknown>).features;
  if (!features || typeof features !== "object") return { ...DEFAULT_ORG_FEATURES };
  return {
    ...DEFAULT_ORG_FEATURES,
    ...(features as OrgFeatureFlags),
  };
}

export function orgHasFeature(settings: unknown, key: OrgFeatureKey): boolean {
  return readOrgFeatureFlags(settings)[key] === true;
}

export type DioceseOfficerRole =
  | "diocese_bishop"
  | "diocese_general_secretary"
  | "diocese_treasurer"
  | "diocese_committee_head";

export type DistrictOfficerRole =
  | "district_head"
  | "district_secretary"
  | "district_treasurer"
  | "district_committee_head";

export type OrgStatus = "active" | "suspended" | "provisioning";

export type OrganizationRow = {
  id: string;
  name: string;
  display_name?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  district_id?: string | null;
  timezone?: string | null;
  status?: OrgStatus | null;
  settings?: unknown;
};
