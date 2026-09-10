/**
 * Shared Contiq admin DataGrid surface tokens.
 * Soft slate grid lines (not currentColor/black from table preflight).
 */
export const contiqTableLayout = {
  cellBorder: true,
  dense: true,
  headerBackground: true,
  rowBorder: true,
  headerBorder: true,
} as const;

export const contiqTableContainerClassName =
  "rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden";

export const contiqTableClassNames = {
  base: "border-border",
  header: "bg-slate-50",
  headerRow: "border-border",
  bodyRow: "border-border hover:bg-slate-50/80",
  edgeCell: "border-border",
} as const;
