import { ArticleStatus, ArticleSummary } from "@/admin/utils/types";
import { Clock, RefreshCw, RotateCcw, Search } from "lucide-react";
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
import {
  DataGridVirtualScrollArea,
  fitRowsHeight,
} from "@/components/reui/data-grid/data-grid-virtual-scroll-area";
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
import { Button } from "@/components/ui/button";
import { api } from "@/http-client";
import { toast } from "sonner";

type ArticlesTableProps = {
  articles: ArticleSummary[];
  onRowClick?: (id: string) => void;
  statusCounts?: {
    total: number;
    approved: number;
    pending: number;
    rewrite_required: number;
    failed: number;
  } | null;
  onFetchMore?: () => void;
  isFetchingMore?: boolean;
  hasMore?: boolean;
  onReevaluated?: (articleId: string) => void;
  timedOutIds?: Set<string>;
  onCheckAgain?: (articleId: string) => void;
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

const EMPTY_TIMED_OUT_IDS: Set<string> = new Set();

export default function ArticlesTableContent({
  articles,
  onRowClick,
  statusCounts,
  onFetchMore,
  isFetchingMore,
  hasMore,
  onReevaluated,
  timedOutIds = EMPTY_TIMED_OUT_IDS,
  onCheckAgain,
}: ArticlesTableProps) {
  const [titleFilter, setTitleFilter] = useState("");
  const [reevaluatingIds, setReevaluatingIds] = useState<Set<string>>(
    new Set(),
  );

  const locallyFilteredArticles = useMemo(() => {
    const normalizedTitle = titleFilter.trim().toLowerCase();
    if (!normalizedTitle) return articles;
    return articles.filter((article) =>
      article.title.toLowerCase().includes(normalizedTitle),
    );
  }, [articles, titleFilter]);

  // Server-computed, from the same month/status/type filters as the list —
  // total is always the sum of the four below, and none of them grow just
  // because more rows get scroll-loaded. Doesn't reflect the author/title
  // quick filters below (those are client-side only, out of the server's
  // view), so the cards describe the filtered dataset, not the currently
  // visible/searched rows.
  const dashboard = {
    total: statusCounts?.total ?? 0,
    approved: statusCounts?.approved ?? 0,
    pending: statusCounts?.pending ?? 0,
    rewriteRequired: statusCounts?.rewrite_required ?? 0,
    failed: statusCounts?.failed ?? 0,
  };

  async function handleReevaluate(id: string) {
    if (!id || reevaluatingIds.has(id)) return;
    setReevaluatingIds((prev) => new Set(prev).add(id));
    try {
      await api(`/admin/articles/${id}/reevaluate`, { method: "POST" });
      toast.success("Re-evaluation started");
      // Immediate refresh so the row picks up the new "pending" status right
      // away; the parent's polling (while any row is pending) takes over
      // from there until scoring finishes.
      onReevaluated?.(id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setReevaluatingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

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
        size: 290,
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
        size: 140,
        cell: ({ getValue }) => {
          const name = getValue() as string;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-7 shrink-0 rounded-full bg-teal-600 text-white text-[11px] font-semibold flex items-center justify-center">
                      {getNameInitials(name)}
                    </div>
                    <span className="truncate text-sm font-medium text-foreground">
                      {name}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: "article_type_name",
        header: "Type",
        size: 145,
        cell: ({ getValue }) => {
          const typeName = getValue() as string;
          return (
            <Badge
              variant="outline"
              className="max-w-full bg-slate-50 text-slate-700 font-medium border-transparent ring-1 ring-slate-200/80"
            >
              <span className="min-w-0 truncate">{typeName}</span>
            </Badge>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 90,
        cell: ({ row }) => {
          if (timedOutIds.has(row.original.id)) {
            return (
              <div className="flex items-center gap-1">
                <Badge
                  variant="outline"
                  className="gap-1 font-medium border-transparent bg-slate-50 text-slate-600 ring-1 ring-slate-200/80"
                  title="Still pending after 5 minutes of auto-refreshing — the score may still land, or this article may need re-evaluating."
                >
                  <Clock className="size-3" />
                  Taking longer than expected
                </Badge>
              </div>
            );
          }

          const status = row.original.status;
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
        size: 120,
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
        accessorKey: "created_at",
        header: "Created",
        size: 105,
        cell: ({ getValue }) => (
          <span className="text-[13px]">
            {formatDateToUSLocale(getValue() as string)}
          </span>
        ),
      },
      {
        accessorKey: "updated_at",
        header: "Edited",
        size: 105,
        cell: ({ getValue }) => (
          <span className="text-[13px]">
            {formatDateToUSLocale(getValue() as string)}
          </span>
        ),
      },
      {
        accessorKey: "re_evaluate",
        header: "Re-evaluate article",
        size: 95,
        cell: ({ row }) => {
          const busy = reevaluatingIds.has(row.id);
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReevaluate(row.id);
              }}
              disabled={busy}
              className="rounded-md p-2 transition-all duration-200 hover:bg-gray-200 hover:text-teal-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              title="Re-evaluate article"
            >
              <RotateCcw
                className={cn(
                  "h-5 w-5 transition-transform duration-300",
                  busy ? "animate-spin" : "hover:rotate-180",
                )}
              />
            </button>
          );
        },
      },
    ],
    [reevaluatingIds, timedOutIds, onCheckAgain],
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
        <div className="rounded-sm border border-border bg-background px-3.5 py-2.5">
          <div className="text-xs text-muted-foreground">Failed</div>
          <div className="mt-0.5 text-xl font-semibold tabular-nums text-red-600">
            {dashboard.failed}
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
        tableLayout={{ ...contiqTableLayout, headerSticky: true }}
        tableClassNames={contiqTableClassNames}
      >
        <div className="w-full space-y-2.5">
          <DataGridContainer className={contiqTableContainerClassName}>
            <DataGridVirtualScrollArea
              height={fitRowsHeight(locallyFilteredArticles.length, "49.7vh")}
              onFetchMore={onFetchMore}
              isFetchingMore={isFetchingMore}
              hasMore={hasMore}
            />
          </DataGridContainer>
        </div>
      </DataGrid>
    </div>
  );
}
