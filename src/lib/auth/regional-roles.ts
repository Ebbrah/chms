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

export const DIOCESE_ROLE_LABELS: Record<DioceseOfficerRole, string> = {
  diocese_bishop: "Askofu",
  diocese_general_secretary: "Katibu Mkuu wa Dayosisi",
  diocese_treasurer: "Mhasibu wa Dayosisi",
  diocese_committee_head: "Mwenyekiti wa Kamati (Dayosisi)",
};

export const DISTRICT_ROLE_LABELS: Record<DistrictOfficerRole, string> = {
  district_head: "Mkuu wa Jimbo",
  district_secretary: "Katibu wa Jimbo",
  district_treasurer: "Mhasibu wa Jimbo",
  district_committee_head: "Mwenyekiti wa Kamati (Jimbo)",
};
