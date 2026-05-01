export function toDisplayCaps(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  return text.toLocaleUpperCase();
}
