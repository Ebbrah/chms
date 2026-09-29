/** Normalize Tanzanian/local numbers to E.164 (+255…). */
export function normalizePhoneE164(raw: string, defaultCountry = "255"): string | null {
  let digits = raw.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const cc = defaultCountry.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith(cc) && digits.length >= 11) {
    return `+${digits}`;
  }
  if (digits.startsWith("0")) {
    digits = cc + digits.slice(1);
  } else if (digits.length <= 10) {
    digits = cc + digits;
  }
  return `+${digits}`;
}
