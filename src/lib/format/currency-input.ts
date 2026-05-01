/** Parse user-entered amounts: strips commas, spaces, then parses (for API / server). */
export function parseAmountInput(raw: string | null | undefined): number {
  const t = String(raw ?? "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();
  if (t === "" || t === "-" || t === ".") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** Thousand separators for display while typing is not active (en-KE, up to 2 decimals). */
export function formatAmountInputDisplay(n: number): string {
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}
