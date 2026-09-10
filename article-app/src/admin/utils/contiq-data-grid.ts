/**
 * Shared Contiq admin DataGrid surface tokens.
 * Matches ReUI examples: cell borders, dense rows, muted header, bordered card.
 */
export const contiqTableLayout = {
  cellBorder: true,
  dense: true,
  headerBackground: true,
  rowBorder: true,
} as const;

export const contiqTableContainerClassName =
  "rounded-lg border border-border bg-background shadow-sm overflow-hidden";
