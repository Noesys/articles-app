import { ChevronUp, ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { ColumnDef, useTable } from "@tanstack/react-table";
import { contiqTableClassNames, contiqTableContainerClassName, contiqTableLayout } from "@/admin/utils/contiq-data-grid";

type Row = { parameter_name: string; name?: string; parameter_description?: string | null; description?: string | null; scope_type?: string; scopeType?: string; max_value?: number | null; maxValue?: number | null; value: string | number | null };

export default function ParameterResultsBox({ results }: { results: Row[] }) {
  const [open, setOpen] = useState(false);
  const columns = useMemo<ColumnDef<DataGridFeatures, Row>[]>(
    () => [
      { accessorKey: "parameter_name", header: "Parameter", cell: ({ row }) => <span className="font-medium text-slate-700">{row.original.parameter_name || row.original.name}</span> },
      { accessorKey: "parameter_description", header: "Description", cell: ({ row }) => { const d = row.original.parameter_description ?? row.original.description ?? "—"; return <span className="text-slate-500 line-clamp-2">{d || "—"}</span>; } },
      { id: "score", header: "Score", cell: ({ row }) => { const r = row.original; const max = r.max_value ?? r.maxValue; const scope = r.scope_type ?? r.scopeType; const isNumeric = scope === "numeric" && typeof r.value === "number" && max != null; const display = isNumeric ? `${r.value}/${max}` : r.value == null ? "—" : String(r.value); return <span className="inline-block font-semibold text-slate-900 bg-white border border-slate-200 rounded-sm px-2.5 py-0.5">{display}</span>; } },
    ],
    [],
  );
  const table = useTable({ features: dataGridFeatures, columns, data: results, pageCount: 1, getRowId: (_, i) => String(i), state: { pagination: { pageIndex: 0, pageSize: Math.max(results.length, 5) } } });
  if (!results || !results.length)
    return (
      <div className="rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden">
        <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3">
          <p className="text-md font-semibold uppercase tracking-wide text-slate-600">Parameter Results</p>
          {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </button>
        {open && <div className="px-4 pb-4"><p className="text-sm text-slate-400">No parameter results yet</p></div>}
      </div>
    );
  return (
    <div className="rounded-sm border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3">
        <p className="text-md font-semibold uppercase tracking-wide text-slate-600">Parameter Results</p>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      {open && (
        <DataGrid table={table} recordCount={results.length} tableLayout={contiqTableLayout} tableClassNames={contiqTableClassNames}>
          <DataGridContainer className={contiqTableContainerClassName}>
            <DataGridScrollArea><DataGridTable /></DataGridScrollArea>
          </DataGridContainer>
        </DataGrid>
      )}
    </div>
  );
}
