/**
 * Maps member_details JSON to demographic categories for diocese/district roll-ups (MT-4).
 *
 * Source fields in member_details:
 * - gender: "Mwanamume" | "Mwanamke"
 * - birth_date: ISO date string
 * - marital_status: includes "Mjane" (widow), "Mgane" (widower)
 * - is_orphan: "Ndio" | "Hapana" (optional; add to member form in a later phase)
 */
export type DemographicAgeBand = "child" | "youth" | "adult" | "unknown";
export type DemographicGenderCategory = "male" | "female" | "unknown";

export type DemographicBands = {
  childMax: number;
  youthMax: number;
};

export const DEFAULT_DEMOGRAPHIC_BANDS: DemographicBands = {
  childMax: 12,
  youthMax: 35,
};

export type MemberDemographicFlags = {
  genderCategory: DemographicGenderCategory;
  isFemale: boolean;
  isMale: boolean;
  isWidow: boolean;
  isWidower: boolean;
  isOrphan: boolean;
  ageYears: number | null;
  ageBand: DemographicAgeBand;
};

function readText(details: Record<string, unknown>, key: string) {
  return String(details[key] ?? "").trim();
}

function parseAgeYears(birthDateRaw: string): number | null {
  if (!birthDateRaw) return null;
  const birth = new Date(`${birthDateRaw}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export function memberDemographicFlags(
  detailsInput: unknown,
  bands: DemographicBands = DEFAULT_DEMOGRAPHIC_BANDS,
): MemberDemographicFlags {
  const details =
    detailsInput && typeof detailsInput === "object"
      ? (detailsInput as Record<string, unknown>)
      : {};

  const genderRaw = readText(details, "gender").toLowerCase();
  const maritalStatus = readText(details, "marital_status");
  const orphanRaw = readText(details, "is_orphan");

  const isFemale = ["mwanamke", "female", "f"].includes(genderRaw);
  const isMale = ["mwanamume", "male", "m"].includes(genderRaw);
  const isWidow = maritalStatus === "Mjane";
  const isWidower = maritalStatus === "Mgane";
  const isOrphan = ["ndio", "yes", "true", "1"].includes(orphanRaw.toLowerCase());

  let genderCategory: DemographicGenderCategory = "unknown";
  if (isFemale) genderCategory = "female";
  else if (isMale) genderCategory = "male";

  const ageYears = parseAgeYears(readText(details, "birth_date"));
  let ageBand: DemographicAgeBand = "unknown";
  if (ageYears != null) {
    if (ageYears <= bands.childMax) ageBand = "child";
    else if (ageYears <= bands.youthMax) ageBand = "youth";
    else ageBand = "adult";
  }

  return {
    genderCategory,
    isFemale,
    isMale,
    isWidow,
    isWidower,
    isOrphan,
    ageYears,
    ageBand,
  };
}

export function memberDisplayName(detailsInput: unknown, fallback = ""): string {
  const details =
    detailsInput && typeof detailsInput === "object"
      ? (detailsInput as Record<string, unknown>)
      : {};
  return readText(details, "full_name") || fallback;
}
