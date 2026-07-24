/** Rank offering-number hits so exact / prefix matches appear before substring matches (e.g. "8" before "18"). */
export function offeringNumberSearchRank(query: string, offeringNumber: string): number {
  const q = query.trim().toLowerCase().replace(/\s+/g, "");
  const n = offeringNumber.trim().toLowerCase().replace(/\s+/g, "");
  if (!q || !n) return 3;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.includes(q)) return 2;
  return 3;
}

export function compareOfferingNumberSearchHits(
  query: string,
  aOfferingNumber: string,
  bOfferingNumber: string,
): number {
  const ra = offeringNumberSearchRank(query, aOfferingNumber);
  const rb = offeringNumberSearchRank(query, bOfferingNumber);
  if (ra !== rb) return ra - rb;
  return aOfferingNumber.localeCompare(bOfferingNumber, undefined, { numeric: true });
}
