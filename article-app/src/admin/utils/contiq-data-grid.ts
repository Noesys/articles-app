/**
 * Shared Contiq admin DataGrid surface tokens.
 * Soft slate grid lines (not currentColor/black from table preflight).
 * Header: sentence-case semibold via CSS + column labels.
 */
export const contiqTableLayout = {
  cellBorder: true,
  dense: true,
  headerBackground: true,
  rowBorder: true,
  headerBorder: true,
} as const;

export const contiqTableContainerClassName =
  "rounded-sm border border-slate-200 bg-white shadow-[var(--shadow-card)] overflow-hidden";

export const contiqTableClassNames = {
  base: "border-border",
  header: "bg-slate-50 [&_th]:text-sm [&_th]:font-semibold [&_th]:text-slate-700",
  headerRow: "border-border",
  bodyRow:
    "border-border transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-out-contiq)] hover:bg-slate-50/80",
  edgeCell: "border-border",
  // Opaque (not the default bg-background/90 backdrop-blur) so rows don't
  // show through the header while it's pinned during scroll. Only applied
  // where a table opts into tableLayout.headerSticky.
  headerSticky: "sticky top-0 z-40 bg-slate-50 shadow-[var(--shadow-card)]",
} as const;

/** Prefer skeleton loading so tables don't jump. */
export const contiqLoadingMode = "skeleton" as const;
