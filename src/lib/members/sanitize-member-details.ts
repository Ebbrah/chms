/** Drop legacy inline photo blobs from JSON — they can be multi‑MB and slow every profile read. */
export function sanitizeMemberDetailsForDisplay(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const details = { ...(raw as Record<string, unknown>) };
  delete details.passport_photo_data_url;
  return details;
}
