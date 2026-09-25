import Header from "../components/Header";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Loader2, FileText } from "lucide-react";
import dayjs from "dayjs";
import { useInfiniteTableData } from "../hooks/useInfiniteTableData";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
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
import {
  ColumnDef,
  SortingState,
  useTable,
} from "@tanstack/react-table";
import { api, apiFull } from "@/http-client";
import { ArticleListItem, ArticleRow } from "@/utils/types";
import {
  contiqTableContainerClassName,
  contiqTableClassNames,
  contiqTableLayout,
} from "@/admin/utils/contiq-data-grid";
import { cn } from "@/lib/utils";
import { PageHeader, PageShell, FilterToolbar } from "@/components/page-chrome";
import { MonthYearPicker } from "@/admin/components/ui/MonthYearPicker";
import { InlineAlert } from "@/components/ui/inline-alert";
import EmptyState from "@/admin/components/ui/EmptyState";
import { DataGridSkeleton } from "@/components/ui/data-grid-skeleton";

type ArticleStatus = "accepted" | "rejected" | "failed" | "scoring";

const STATUS_CONFIG: Record<string, { className: string; label: string }> = {
  accepted: {
    className:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 border-transparent",
    label: "Accepted",
  },
  rejected: {
    className:
      "bg-red-50 text-red-600 ring-1 ring-red-200/80 border-transparent",
    label: "Rejected",
  },
  scoring: {
    className:
      "bg-slate-50 text-slate-600 ring-1 ring-slate-200/80 border-transparent",
    label: "Scoring...",
  },
};

const POLLING_INTERVAL = 2500;
// Matches STUCK_EVALUATION_THRESHOLD_MS (article-api/src/utils/evaluationTiming.ts)
// and the same constant in ArticleDetail/AdminArticleDetail. There is no backend
// sweep — the backend only treats a pending/processing article as stuck when a
// rewrite/re-evaluate/apply-suggestions call is made on that specific article
// (see isStuckPending); this local timer is what ends the "still scoring" banner
// on this page when nothing else ever touches the article again.
const MAX_POLL_DURATION = 300000;
/** Fetch batch size for "View all" — an implementation detail now that the list is virtualized, not a user-facing setting. */
const VIEW_ALL_FETCH_LIMIT = 30;

function getDisplayStatus(article: {
  status: string;
  ai_score: number | null;
}): {
  key: ArticleStatus;
  label: string;
  className: string;
} {
  if (article.status === "failed") {
    return {
      key: "failed",
      label: "Failed",
      className:
        "bg-orange-50 text-orange-700 ring-1 ring-orange-200/80 border-transparent",
    };
  }

  if (
    article.status === "pending" ||
    article.status === "processing" ||
    article.ai_score === null
  ) {
    return {
      key: "scoring",
      label: STATUS_CONFIG.scoring.label,
      className: STATUS_CONFIG.scoring.className,
    };
  }

  if (article.status === "approved") {
    return {
      key: "accepted",
      label: STATUS_CONFIG.accepted.label,
      className: STATUS_CONFIG.accepted.className,
    };
  }

  return {
    key: "rejected",
    label: STATUS_CONFIG.rejected.label,
    className: STATUS_CONFIG.rejected.className,
  };
}

function getAiScoreClasses(status: string) {
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

export default function MyArticles() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const currentMonth = dayjs().format("YYYY-MM");
  const monthParam = searchParams.get("month");
  const month =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth;
  const viewAll = searchParams.get("viewAll") === "true";
  const typeFilter = searchParams.get("type") || "all";
  const statusFilter = searchParams.get("status") || "all";
  const setFilterParam = (
    name: string,
    value: string,
    defaultValue?: string,
  ) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === defaultValue) next.delete(name);
      else next.set(name, value);
      return next;
    });
  };
  const [articleTypes, setArticleTypes] = useState<
    { id: string; name: string }[]
  >([]);
  const [typesError, setTypesError] = useState<string | null>(null);

  useEffect(() => {
    api<{ id: string; name: string }[]>("/article-types")
      .then(setArticleTypes)
      .catch((err) =>
        setTypesError(
          err instanceof Error ? err.message : "Failed to load types",
        ),
      );
  }, []);

  const fetchArticlesPage = useCallback(
    async ({
      page,
      limit,
      viewAll: fetchViewAll,
      month: fetchMonth,
    }: {
      page: number;
      limit: number;
      viewAll: boolean;
      month?: string;
    }) => {
      const params = new URLSearchParams();
      if (fetchViewAll) {
        params.set("viewAll", "true");
        params.set("page", String(page));
        params.set("limit", String(limit));
      } else if (fetchMonth) {
        params.set("month", fetchMonth);
      }
      const query = params.toString();
      const result = await apiFull<ArticleRow[]>(
        `/articles/mine${query ? `?${query}` : ""}`,
      );
      const data = result.data.map((row) => ({
        ...row.article,
        authorName: row.author?.name,
      }));
      return { data, total: result.pagination?.total ?? data.length };
    },
    [],
  );

  const {
    rows: articles,
    isLoading: loading,
    isFetchingMore,
    hasMore,
    error,
    fetchMore,
    refetchLoaded,
  } = useInfiniteTableData<ArticleListItem, { viewAll: boolean; month?: string }>({
    fetchPage: fetchArticlesPage,
    params: { viewAll, month: viewAll ? undefined : month },
    limit: viewAll ? VIEW_ALL_FETCH_LIMIT : 10,
  });

  const filteredArticles = useMemo(() => {
    let out = articles;

    if (typeFilter !== "all") {
      out = out.filter(
        (a) =>
          a.type === typeFilter ||
          articleTypes.find((t) => t.id === typeFilter)?.name === a.type,
      );
    }

    if (statusFilter !== "all") {
      out = out.filter((a) => getDisplayStatus(a).key === statusFilter);
    }

    return out;
  }, [articles, typeFilter, statusFilter, articleTypes]);

  // Poll while anything is still scoring, silently re-syncing every
  // currently-loaded row (not just the first page) so live scores land
  // without disrupting scroll position. The interval itself lives for the
  // whole mount and just checks hasPendingRef on each tick — it never gets
  // torn down and rebuilt off a dependency change, so there's no window
  // where a stale effect keeps ticking after the last article resolves.
  const hasPending = articles.some(
    (a) =>
      a.status === "pending" ||
      a.status === "processing" ||
      (a.ai_score === null && a.status !== "failed"),
  );
  const [isPolling, setIsPolling] = useState(false);
  const hasPendingRef = useRef(hasPending);
  hasPendingRef.current = hasPending;
  const pollStartRef = useRef<number | null>(null);
  const refetchLoadedRef = useRef(refetchLoaded);
  refetchLoadedRef.current = refetchLoaded;

  // The moment nothing is pending anymore, drop the banner and any stale
  // timeout flag immediately — independent of the interval's own cadence.
  useEffect(() => {
    if (!hasPending) {
      pollStartRef.current = null;
      setIsPolling(false);
      try {
        sessionStorage.removeItem("toastError");
      } catch {}
    }
  }, [hasPending]);

  useEffect(() => {
    const tick = () => {
      if (!hasPendingRef.current) return;
      if (document.visibilityState === "hidden") return;

      if (pollStartRef.current === null) pollStartRef.current = Date.now();
      if (Date.now() - pollStartRef.current > MAX_POLL_DURATION) {
        pollStartRef.current = null;
        setIsPolling(false);
        try {
          sessionStorage.setItem("toastError", "Scoring timed out");
        } catch {}
        return;
      }

      setIsPolling(true);
      refetchLoadedRef.current({ silent: true });
    };

    const interval = window.setInterval(tick, POLLING_INTERVAL);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(
    () => {
      try {
        const t = sessionStorage.getItem("toast");
        const te = sessionStorage.getItem("toastError");
        if (t) {
          sessionStorage.removeItem("toast");
          if (te) sessionStorage.removeItem("toastError");
          return { message: t, variant: "success" };
        }
        if (te) {
          sessionStorage.removeItem("toastError");
          return { message: te, variant: "error" };
        }
        return null;
      } catch {
        return null;
      }
    },
  );

  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(id);
    }
    return;
  }, [toast]);

  return (
    <div className="h-full bg-[#f3f4f6]">
      {user?.auth_role === "user" && <Header />}

      <PageShell>
        <PageHeader
          title="My articles"
          subtitle={
            !loading
              ? `${filteredArticles.length} ${filteredArticles.length === 1 ? "article" : "articles"}`
              : undefined
          }
          actions={
            <Button type="button" size="lg" onClick={() => navigate("/articles/new")}>
              <Plus size={16} />
              New article
            </Button>
          }
        />

        <FilterToolbar>
          <MonthYearPicker
            label="Month"
            value={month}
            onChange={(ym) => setFilterParam("month", ym, currentMonth)}
            disabled={viewAll}
          />
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-pressed={viewAll}
            className="h-9 border-border bg-white text-slate-600"
            onClick={() => {
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                if (viewAll) next.delete("viewAll");
                else next.set("viewAll", "true");
                return next;
              });
            }}
          >
            {viewAll ? "Current month" : "View all"}
          </Button>

          <FilterSelect
            value={typeFilter}
            onValueChange={(value) => setFilterParam("type", value, "all")}
            placeholder="Filter by type"
            aria-label="Article type"
            className="w-[180px]"
            options={[
              { value: "all", label: "All types" },
              ...articleTypes.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
          <FilterSelect
            value={statusFilter}
            onValueChange={(value) => setFilterParam("status", value, "all")}
            placeholder="Filter by status"
            aria-label="Status"
            className="w-[180px]"
            options={[
              { value: "all", label: "All statuses" },
              { value: "accepted", label: "Accepted" },
              { value: "rejected", label: "Rejected" },
              { value: "failed", label: "Failed"}
            ]}
          />
        </FilterToolbar>

        {typesError && <InlineAlert>{typesError}</InlineAlert>}
        {toast && (
          <InlineAlert variant={toast.variant}>
            {toast.message}
          </InlineAlert>
        )}
        {isPolling && (
          <InlineAlert variant="warning" role="status">
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" aria-hidden />
              Processing your submission — auto-refreshing…
            </span>
          </InlineAlert>
        )}
        {error && <InlineAlert>{error}</InlineAlert>}

        {loading ? (
          <DataGridSkeleton rows={8} cols={6} />
        ) : (
          <MyArticlesTable
            articles={filteredArticles}
            onRowClick={(id) => navigate(`/articles/${id}`)}
            month={month}
            viewAll={viewAll}
            onCreate={() => navigate("/articles/new")}
            onFetchMore={fetchMore}
            isFetchingMore={isFetchingMore}
            hasMore={hasMore}
          />
        )}
      </PageShell>
    </div>
  );
}

function MyArticlesTable({
  articles,
  onRowClick,
  month,
  viewAll,
  onCreate,
  onFetchMore,
  isFetchingMore,
  hasMore,
}: {
  articles: ArticleListItem[];
  onRowClick: (id: string) => void;
  month: string;
  viewAll: boolean;
  onCreate: () => void;
  onFetchMore: () => void;
  isFetchingMore: boolean;
  hasMore: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "created", desc: true },
  ]);

  const columns = useMemo<ColumnDef<DataGridFeatures, ArticleListItem>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        size: 280,
        cell: ({ getValue }) => {
          const title = getValue() as string;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex min-h-7 items-center truncate text-[13px] font-semibold text-slate-800">
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
        accessorKey: "type",
        header: "Type",
        size: 115,
        cell: ({ getValue }) => {
          const typeName = getValue() as string;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex min-h-7 max-w-full items-center">
                    <Badge
                      variant="outline"
                      className="max-w-full border-transparent bg-slate-50 font-medium text-slate-700 ring-1 ring-slate-200/80"
                    >
                      <span className="min-w-0 truncate">{typeName}</span>
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{typeName}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: "version",
        header: "Version",
        size: 85,
        cell: ({ getValue }) => (
          <span className="flex min-h-7 items-center text-[13px] text-slate-700">
            v{getValue() as number}
          </span>
        ),
      },
      {
        accessorKey: "ai_score",
        header: "AI score",
        size: 120,
        cell: ({ row }) => {
          const score = row.original.ai_score;
          if (score === null)
            return (
              <span className="flex min-h-7 items-center text-[13px] text-slate-700">
                —
              </span>
            );
          const classes = getAiScoreClasses(row.original.status);
          return (
            <span className="flex min-h-7 items-center gap-2">
              <Progress
                value={Math.min(Math.max(score, 0), 10) * 10}
                className={cn("h-1.5 w-14", classes.bar)}
              />
              <span
                className={cn(
                  "text-[13px] font-semibold tabular-nums",
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
        id: "status",
        accessorFn: (row) => getDisplayStatus(row).key,
        header: "Status",
        size: 115,
        cell: ({ row }) => {
          const cfg = getDisplayStatus(row.original);
          return (
            <span className="flex min-h-7 items-center">
              <Badge
                variant="outline"
                className={cn("font-medium", cfg.className)}
              >
                {cfg.label}
              </Badge>
            </span>
          );
        },
      },
      {
        accessorKey: "created",
        header: "Created",
        size: 110,
        cell: ({ getValue }) => (
          <span className="flex min-h-7 items-center text-[13px] text-slate-700">
            {dayjs(getValue() as string).format("MMM D, YYYY")}
          </span>
        ),
      },
      {
        accessorKey: "edited",
        header: "Edited",
        size: 110,
        cell: ({ getValue }) => (
          <span className="flex min-h-7 items-center text-[13px] text-slate-700">
            {dayjs(getValue() as string).format("MMM D, YYYY")}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: articles,
    pageCount: 1,
    getRowId: (row) => row.id,
    state: {
      pagination: { pageIndex: 0, pageSize: articles.length || 1 },
      sorting,
    },
    onSortingChange: setSorting,
  });

  if (articles.length === 0) {
    return (
      <EmptyState
        icon={<FileText size={20} />}
        title={
          viewAll
            ? "No articles yet"
            : `No articles for ${dayjs(month).format("MMMM YYYY")}`
        }
        description="Write an article to get started."
        action={
          <Button type="button" onClick={onCreate}>
            <Plus size={16} />
            New article
          </Button>
        }
      />
    );
  }

  return (
    <DataGrid
      table={table}
      recordCount={articles.length}
      onRowClick={(row) => onRowClick(row.id)}
      emptyMessage={
        viewAll
          ? "No articles found."
          : `No articles for ${dayjs(month).format("MMMM YYYY")}.`
      }
      tableLayout={{ ...contiqTableLayout, headerSticky: true }}
      tableClassNames={contiqTableClassNames}
    >
      <div className="w-full space-y-2.5">
        <DataGridContainer className={contiqTableContainerClassName}>
          <DataGridVirtualScrollArea
            height={fitRowsHeight(articles.length, "57vh")}
            onFetchMore={onFetchMore}
            isFetchingMore={isFetchingMore}
            hasMore={hasMore}
          />
        </DataGridContainer>
      </div>
    </DataGrid>
  );
}
