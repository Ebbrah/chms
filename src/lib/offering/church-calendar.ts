/**
 * Church-local calendar helpers. Server components often run in UTC; elders are
 * gated by "Sunday" and the Sun–Sat week in the congregation's timezone.
 *
 * Override with CHURCH_TIMEZONE (IANA), e.g. Africa/Dar_es_Salaam.
 */
const DEFAULT_CHURCH_TIMEZONE = "Africa/Nairobi";

export function getChurchTimeZone(): string {
  const raw = process.env.CHURCH_TIMEZONE?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_CHURCH_TIMEZONE;
}

function churchLocalYmd(date: Date): { y: number; m: number; d: number } {
  const tz = getChurchTimeZone();
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
  };
}

/** Gregorian YYYY-MM-DD for the church timezone at `date` (default: now). */
export function getChurchLocalDateISO(date: Date = new Date()): string {
  const { y, m, d } = churchLocalYmd(date);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Whether `date` falls on a Sunday on the church's local calendar. */
export function isChurchLocalSunday(date: Date = new Date()): boolean {
  const tz = getChurchTimeZone();
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
  }).format(date);
  return weekday === "Sunday";
}

function formatYmdUtcMs(ms: number): string {
  const u = new Date(ms);
  const y = u.getUTCFullYear();
  const m = String(u.getUTCMonth() + 1).padStart(2, "0");
  const d = String(u.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Sunday–Saturday week (Gregorian) containing the church-local calendar day of `date`.
 * Returns ISO date strings suitable for `offering_week_batches.week_*` columns.
 */
export function getChurchWeekRangeISO(date: Date = new Date()): { weekStart: string; weekEnd: string } {
  const { y, m, d } = churchLocalYmd(date);
  const anchor = Date.UTC(y, m - 1, d);
  const dow = new Date(anchor).getUTCDay();
  const startMs = anchor - dow * 86400000;
  const endMs = startMs + 6 * 86400000;
  return { weekStart: formatYmdUtcMs(startMs), weekEnd: formatYmdUtcMs(endMs) };
}
