import type { Pagination } from "./api.js";

/** Shared text helpers for tool responses. */

export function paginationLine(p?: Pagination): string {
  if (!p) return "";
  return `\n_Page ${p.page} of ${p.totalPages} (${p.total} total)._`;
}

export function bullet(label: string, value: unknown): string {
  const v = value === null || value === undefined || value === "" ? "—" : String(value);
  return `- **${label}:** ${v}`;
}

export function truncate(text: string, max = 400): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}
