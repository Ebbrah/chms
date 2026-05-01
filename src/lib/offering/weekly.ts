/** Max envelope rows per weekly save (import grid and server must match). */
export const WEEKLY_OFFERING_ROW_LIMIT = 250;

/** Batch slot within the church week: two Sunday services + mid-week batch. */
export const OFFERING_BATCH_SLOT_FIRST_SERVICE = 1;
export const OFFERING_BATCH_SLOT_SECOND_SERVICE = 2;
export const OFFERING_BATCH_SLOT_MIDWEEK = 3;

/** User-visible label for a `batch_slot` (1–3 = planned services; higher = extra batches in that week). */
export function offeringBatchSlotLabel(slot: number): string {
  if (slot === OFFERING_BATCH_SLOT_FIRST_SERVICE) return "Sunday service 1";
  if (slot === OFFERING_BATCH_SLOT_SECOND_SERVICE) return "Sunday service 2";
  if (slot === OFFERING_BATCH_SLOT_MIDWEEK) return "Mid-week";
  return `Batch ${slot}`;
}

/** Canonical offering type names (must match rows in `offering_types` per org). */
export const WEEKLY_OFFERING_TYPE_NAMES = [
  "Ahadi",
  "Jengo",
  "Maendeleo ya Dayosisi",
] as const;

export type WeeklyOfferingColumn = (typeof WEEKLY_OFFERING_TYPE_NAMES)[number];

export type WeeklyOfferingRowInput = {
  offering_number: string;
  ahadi: number;
  jengo: number;
  maendeleo: number;
};

/** Sunday–Saturday week containing `date` (local calendar). */
export function getWeekRangeContainingDate(d: Date): { weekStart: Date; weekEnd: Date } {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay(); // 0 Sun … 6 Sat
  // Move back to previous Sunday (or stay if already Sunday)
  const sundayOffset = -day;
  const weekStart = new Date(x);
  weekStart.setDate(x.getDate() + sundayOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return { weekStart, weekEnd };
}

export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Use the calendar day the user picked (YYYY-MM-DD) as `offerings.received_at`. */
export function receivedAtFromUserPickedDate(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}
