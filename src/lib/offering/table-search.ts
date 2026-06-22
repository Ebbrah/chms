import { formatAmountTZS } from "@/lib/format/amount";
import { parseAmountInput } from "@/lib/format/currency-input";

/** Match rows when the user searches by TZS amount (raw, formatted, or comma-separated). */
export function matchesOfferingAmountSearch(query: string, amounts: number[]): boolean {
  const q = query.trim();
  if (!q) return false;
  const qNorm = q.replace(/,/g, "").replace(/\s/g, "").toLowerCase();
  const parsed = parseAmountInput(q);

  for (const amt of amounts) {
    if (!Number.isFinite(amt) || amt === 0) continue;
    const raw = String(amt);
    const formatted = formatAmountTZS(amt);
    const formattedNorm = formatted.replace(/,/g, "").toLowerCase();
    if (
      raw.includes(qNorm) ||
      formatted.toLowerCase().includes(q.toLowerCase()) ||
      formattedNorm.includes(qNorm)
    ) {
      return true;
    }
    if (parsed > 0 && Math.abs(amt - parsed) < 0.005) return true;
  }
  return false;
}
