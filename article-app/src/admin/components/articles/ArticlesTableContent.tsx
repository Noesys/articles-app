import { ArticleStatus, ArticleSummary } from "@/admin/utils/types";
import { Clock, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatDateToUSLocale } from "@/admin/utils/date";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { ColumnDef, useTable } from "@tanstack/react-table";
import {
  contiqTableContainerClassName,
  contiqTableClassNames,
  contiqTableLayout,
} from "@/admin/utils/contiq-data-grid";
import { cn } from "@/lib/utils";
import { getScoreColor } from "@/utils/scoreColor";
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/reui/autocomplete";

type ArticlesTableProps = {
  articles: ArticleSummary[];
  onRowClick?: (id: string) => void;
  totalCount?: number;
};

function getAiScoreClasses(score: number, status: ArticleStatus) {
  const c = getScoreColor(score, null, status);
  return { text: c.text, bar: c.barTw };
}

const STATUS_CONFIG: Record<
  ArticleStatus,
  { className: string; label: string; icon?: boolean }
> = {
  approved: {
    className:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 border-transparent",
    label: "Accepted",
  },
  rewrite_required: {
    className:
      "bg-red-50 text-red-600 ring-1 ring-red-200/80 border-transparent",
    label: "Rejected",
  },
  pending: {
    className:
      "bg-amber-50 text-amber-700 gap-1 ring-1 ring-amber-200/80 border-transparent",
    label: "Pending",
    icon: true,
  },
  failed: {
    className:
      "bg-orange-50 text-orange-700 ring-1 ring-orange-200/80 border-transparent",
    label: "Failed",
  },
  unknown: {
    className:
      "bg-slate-50 text-slate-600 ring-1 ring-slate-200/80 border-transparent",
    label: "Unavailable",
  },
};

function getNameInitials(name: string) {
  if (!name || typeof name !== "string") return "?";
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export default function ArticlesTableContent({
  articles,
  onRowClick,
  totalCount,
}: ArticlesTableProps) {
  const [titleFilter, setTitleFilter] = useState("");

  const locallyFilteredArticles = useMemo(() => {
    const normalizedTitle = titleFilter.trim().toLowerCase();
    if (!normalizedTitle) return articles;
    return articles.filter((article) =>
      article.title.toLowerCase().includes(normalizedTitle),
    );
  }, [articles, titleFilter]);

  const dashboard = useMemo(() => {
    const total = titleFilter
      ? locallyFilteredArticles.length
      : (totalCount ?? locallyFilteredArticles.length);
    const approved = locallyFilteredArticles.filter(
      (a) => a.status === "approved",
    ).length;
    const pending = locallyFilteredArticles.filter(
      (a) => a.status === "pending",
    ).length;
    const rewriteRequired = locallyFilteredArticles.filter(
      (a) => a.status === "rewrite_required",
    ).length;
    const scored = locallyFilteredArticles.filter((a) => a.ai_score !== null);
    const averageScore =
      scored.length > 0
        ? scored.reduce((sum, a) => sum + (a.ai_score ?? 0), 0) / scored.length
        : null;

    return { total, approved, pending, rewriteRequired, averageScore };
  }, [locallyFilteredArticles]);

  const searchItems = useMemo(
    () =>
      articles.map((a) => ({
        id: a.id,
        value: a.title,
      })),
    [articles],
  );

  const columns = useMemo<ColumnDef<DataGridFeatures, ArticleSummary>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        size: 340,
        cell: ({ getValue }) => {
          const title = getValue() as string;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="block truncate font-medium text-foreground text-[13px]">
                    {title}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{title}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: "author_name",
        header: "Author",
        size: 160,
        cell: ({ getValue }) => {
          const name = getValue() as string;
          return (
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-7 shrink-0 rounded-full bg-teal-600 text-white text-[11px] font-semibold flex items-center justify-center">
                {getNameInitials(name)}
              </div>
              <span className="truncate text-sm font-medium text-foreground">
                {name}
              </span>
            </div>
          );
        },
      },
      {
        accessorKey: "article_type_name",
        header: "Type",
        size: 130,
        cell: ({ getValue }) => {
          const typeName = getValue() as string;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="max-w-full bg-slate-50 text-slate-700 font-medium border-transparent ring-1 ring-slate-200/80"
                  >
                    <span className="min-w-0 truncate">{typeName}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>{typeName}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 115,
        cell: ({ getValue }) => {
          const status = getValue() as ArticleStatus;
          const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
          return (
            <Badge
              variant="outline"
              className={cn("font-medium", cfg.className)}
            >
              {cfg.icon ? <Clock className="size-3" /> : null}
              {cfg.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "version",
        header: "Version",
        size: 85,
        cell: ({ getValue }) => (
          <span className="text-sm">v{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "ai_score",
        header: "AI score",
        size: 130,
        cell: ({ row }) => {
          const score = row.original.ai_score;
          if (score === null) return <span className="text-[13px]">—</span>;
          const classes = getAiScoreClasses(score, row.original.status);
          return (
            <span className="inline-flex items-center gap-2">
              <Progress
                value={Math.min(Math.max(score, 0), 10) * 10}
                className={cn("w-14 h-1.5", classes.bar)}
              />
              <span
                className={cn(
                  "font-semibold text-[13px] tabular-nums",
                  classes.text,
                )}
              >
                {score}
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: "submitted_at",
        header: "Created",
        size: 125,
        cell: ({ getValue }) => (
          <span className="text-[13px]">
            {formatDateToUSLocale(getValue() as string)}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: locallyFilteredArticles,
    pageCount: 1,
    getRowId: (row) => row.id,
    state: {
      pagination: {
        pageIndex: 0,
        pageSize: locallyFilteredArticles.length || 1,
      },
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-sm border border-border bg-background px-3.5 py-2.5">
          <div className="text-xs text-muted-foreground">Total articles</div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums">
            {dashboard.total}
          </div>
        </div>
        <div className="rounded-sm border border-border bg-background px-3.5 py-2.5">
          <div className="text-xs text-muted-foreground">Accepted</div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-600">
            {dashboard.approved}
          </div>
        </div>
        <div className="rounded-sm border border-border bg-background px-3.5 py-2.5">
          <div className="text-xs text-muted-foreground">Pending</div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums text-amber-600">
            {dashboard.pending}
          </div>
        </div>
        <div className="rounded-sm border border-border bg-background px-3.5 py-2.5">
          <div className="text-xs text-muted-foreground">Rejected</div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums text-red-600">
            {dashboard.rewriteRequired}
          </div>
        </div>
      </div>

      <div className="relative flex-1">
        <Autocomplete
          items={searchItems}
          value={titleFilter}
          onValueChange={(value) => setTitleFilter(value ?? "")}
          itemToStringValue={(item) =>
            typeof item === "string" ? item : item.value
          }
        >
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-slate-400"
            />
            <AutocompleteInput
              placeholder="Search title..."
              size="lg"
              className="rounded-sm border-border bg-white pl-9"
              showClear
              aria-label="Search title"
            />
          </div>
          <AutocompleteContent>
            <AutocompleteEmpty>No articles found.</AutocompleteEmpty>
            <AutocompleteList>
              {(item) => (
                <AutocompleteItem key={item.id} value={item}>
                  {item.value}
                </AutocompleteItem>
              )}
            </AutocompleteList>
          </AutocompleteContent>
        </Autocomplete>
      </div>

      <DataGrid
        table={table}
        recordCount={locallyFilteredArticles.length}
        onRowClick={onRowClick ? (row) => onRowClick(row.id) : undefined}
        emptyMessage="No articles found"
        loadingMode="skeleton"
        tableLayout={contiqTableLayout}
        tableClassNames={contiqTableClassNames}
      >
        <div className="w-full space-y-2.5">
          <DataGridContainer className={contiqTableContainerClassName}>
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
          </DataGridContainer>
        </div>
      </DataGrid>
    </div>
  );
}
