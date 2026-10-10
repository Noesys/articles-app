/**
 * Dates arrive in two shapes: ISO with a zone (`2026-10-09T14:03:22.481Z`) and
 * SQLite's CURRENT_TIMESTAMP (`2026-10-09 14:03:22`, UTC, no zone marker —
 * `submitted_at` is written that way on a user rewrite). Both are UTC; without
 * a marker the JS date parsers read the value as local time and shift the hour.
 * Everything that renders an article/history date goes through this helper.
 */
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/;

export function parseUtcDate(value: string): Date {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return new Date(NaN);
  const normalized = HAS_ZONE.test(raw) ? raw : `${raw.replace(" ", "T")}Z`;
  return new Date(normalized);
}

export function formatDateToUSLocale(dateStr: string) {
  const d = parseUtcDate(dateStr);

  if (Number.isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
