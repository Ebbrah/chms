export const APP_ROLES = [
  "admin",
  "treasurer",
  "church_elder",
  "pastor",
  "assistant_pastor",
  "evangelist",
  "committee_head",
  "jumuiya_chairman",
  "member",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const COMMITTEE_KEYS = [
  "evangelism",
  "planning",
  "malezi",
  "diaconic",
  "environmental",
] as const;

export type CommitteeKey = (typeof COMMITTEE_KEYS)[number];

export function parseAppRole(v: string): AppRole | null {
  return APP_ROLES.includes(v as AppRole) ? (v as AppRole) : null;
}
