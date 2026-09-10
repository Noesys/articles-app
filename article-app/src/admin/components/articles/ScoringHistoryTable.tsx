import { HistoryItem } from "@/utils/types";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { ColumnDef, SortingState, useTable } from "@tanstack/react-table";
import {
  contiqTableLayout,
  contiqTableClassNames,
} from "@/admin/utils/contiq-data-grid";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

function getAiScoreClasses(status: HistoryItem["status"]) {
  if (status === "approved") {
    return {
      text: "text-emerald-700",
      bar: "[&_[data-slot=progress-indicator]]:bg-emerald-600",
    };
  }
  if (status === "rewrite_required" || status === "failed") {
    return {
      text: "text-red-600",
      bar: "[&_[data-slot=progress-indicator]]:bg-red-600",
    };
  }
  return {
    text: "text-amber-600",
    bar: "[&_[data-slot=progress-indicator]]:bg-amber-500",
  };
}

function formatAiScore(s: number) {
  return Number.isInteger(s) ? String(s) : s.toFixed(1);
}

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  approved: {
    label: "Accepted",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 border-transparent",
  },
  rewrite_required: {
    label: "Rejected",
    className: "bg-red-50 text-red-600 ring-1 ring-red-200/80 border-transparent",
  },
  pending: {
    label: "Scoring...",
    className: "bg-slate-50 text-slate-600 ring-1 ring-slate-200/80 border-transparent",
  },
  failed: {
    label: "Rejected",
    className: "bg-red-50 text-red-600 ring-1 ring-red-200/80 border-transparent",
  },
};

export default function ScoringHistoryTable({
  history,
  articleId,
}: {
  history: HistoryItem[];
  articleId: string;
}) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([]);
  const pageSize = Math.max(history.length, 1);

  const columns = useMemo<ColumnDef<DataGridFeatures, HistoryItem>[]>(
    () => [
      {
        accessorKey: "version",
        header: "Version",
        size: 90,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() =>
              navigate(`/admin/articles/${articleId}?version=${row.original.version}`)
            }
            className="text-sky-600 font-semibold text-sm cursor-pointer hover:underline"
          >
            Aritcle Version {row.original.version}
          </button>
        ),
      },
      {
        accessorKey: "score",
        header: "AI Score",
        size: 130,
        cell: ({ row }) => {
          const s = row.original.score;
          if (s === null) return <span className="text-slate-400 text-[13px]">—</span>;
          const classes = getAiScoreClasses(row.original.status);
          return (
            <span className="inline-flex items-center gap-2">
              <Progress
                value={Math.min(Math.max(s, 0), 10) * 10}
                className={cn("w-14 h-1.5", classes.bar)}
              />
              <span className={cn("font-semibold text-[13px]", classes.text)}>
                {formatAiScore(s)}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 130,
        cell: ({ row }) => {
          const cfg = STATUS_MAP[row.original.status] || STATUS_MAP.pending;
          return (
            <Badge variant="outline" className={cn("font-medium", cfg.className)}>
              {cfg.label}
            </Badge>
          );
        },
      },
      {
        id: "submitted_at",
        accessorFn: (row) => row.snapshotted_at || row.submitted_at,
        header: "Submitted",
        size: 160,
        cell: ({ row }) => {
          const dateStr = row.original.snapshotted_at || row.original.submitted_at;
          if (!dateStr) return <span className="text-slate-400 text-[13px]">—</span>;
          const normalized =
            typeof dateStr === "string" &&
            dateStr.includes("T") &&
            !dateStr.endsWith("Z") &&
            !/[+-]\d{2}:\d{2}$/.test(dateStr)
              ? `${dateStr}Z`
              : dateStr;
          return (
            <span className="text-slate-700 text-[13px]">
              {dayjs(normalized).format("MMM D, YYYY h:mm A")}
            </span>
          );
        },
      },
    ],
    [articleId, navigate],
  );

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: history,
    pageCount: 1,
    getRowId: (row) => String(row.version),
    state: {
      pagination: { pageIndex: 0, pageSize },
      sorting,
    },
    onSortingChange: setSorting,
  });

  return (
    <div className="rounded-lg border border-border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/40">
        <span className="text-sm font-semibold text-foreground">Scoring History</span>
        <span className="text-xs text-muted-foreground">{history.length} versions</span>
      </div>

      <DataGrid
        table={table}
        recordCount={history.length}
        emptyMessage="No scoring history yet."
        tableLayout={contiqTableLayout}
        tableClassNames={contiqTableClassNames}
      >
        <DataGridContainer className="border-0 rounded-none shadow-none">
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>
      </DataGrid>
    </div>
  );
}
