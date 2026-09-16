import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ArticlesTable from "../../components/articles/ArticlesTable";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { api, apiFull } from "@/http-client";
import { useAuth } from "@/contexts/AuthContext";

import { ChevronLeft, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { ArticleSummary } from "@/admin/utils/types";
import { PageHeader, PageShell, FilterToolbar } from "@/components/page-chrome";
import { MonthYearPicker } from "@/admin/components/ui/MonthYearPicker";
import { InlineAlert } from "@/components/ui/inline-alert";
import { DataGridSkeleton } from "@/components/ui/data-grid-skeleton";
import { useInfiniteTableData } from "@/hooks/useInfiniteTableData";

type ArticleTypeOption = {
  id: string;
  name: string;
};

type ArticlesPageParams = {
  id?: string;
  viewAll: boolean;
  month?: string;
  status: string;
  type: string;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Accepted" },
  { value: "pending", label: "Pending" },
  { value: "rewrite_required", label: "Rejected" },
  { value: "failed", label: "Failed" },
];

/** Fetch batch size — an implementation detail now that the list is virtualized, not a user-facing setting. */
const FETCH_LIMIT = 30;
const POLLING_INTERVAL = 2500;
/** Per-row cap: give up auto-refreshing a single row after this long. */
const ROW_TIMEOUT_MS = 90000;

const AllArticles = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();

  const [articleTypes, setArticleTypes] = useState<ArticleTypeOption[]>([]);
  const [userName, setUserName] = useState("");

  const monthParam = searchParams.get("month");
  const selectedMonthKey =
    monthParam &&
    /^\d{4}-\d{2}$/.test(monthParam) &&
    dayjs(`${monthParam}-01`).isValid()
      ? monthParam
      : dayjs().format("YYYY-MM");
  const selectedStatus = searchParams.get("status") || "all";
  const selectedType = searchParams.get("type") || "all";
  const selectedAuthor = searchParams.get("author") || "all";
  const sortBy = searchParams.get("sort") || "created_desc";
  const [authors, setAuthors] = useState<string[]>([]);

  const viewAll = searchParams.get("viewAll") === "true";
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

  const setViewAll = (next: boolean) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (next) params.set("viewAll", "true");
      else params.delete("viewAll");
      return params;
    });
  };

  const fetchArticleTypes = useCallback(async () => {
    try {
      const response = await api<Array<{ id: string; name: string }>>(
        "/admin/article-types",
      );
      setArticleTypes(
        response.map((type) => ({ id: type.id, name: type.name })),
      );
    } catch (err) {
      console.error("Failed to load article types:", err);
    }
  }, []);

  const fetchAuthors = useCallback(async () => {
    try {
      const response = await api<Array<{ id: string; name: string }>>(
        "/admin/articles/authors",
      );
      setAuthors(response.map((author) => author.name).filter(Boolean));
    } catch (err) {
      console.error("Failed to load authors:", err);
    }
  }, []);

  useEffect(() => {
    fetchArticleTypes();
    fetchAuthors();
  }, [fetchArticleTypes, fetchAuthors]);

  const fetchArticlesPage = useCallback(
    async ({
      page,
      limit,
      id: fetchId,
      viewAll: fetchViewAll,
      month: fetchMonth,
      status,
      type,
    }: { page: number; limit: number } & ArticlesPageParams) => {
      const params = new URLSearchParams();
      if (!fetchViewAll && fetchMonth) params.set("month", fetchMonth);
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (status !== "all") params.set("status", status);
      if (type !== "all") params.set("type", type);

      const path = fetchId
        ? `/admin/users/${fetchId}/articles?${params.toString()}`
        : `/admin/articles?${params.toString()}`;

      const res = (await apiFull<ArticleSummary[]>(path)) as unknown as {
        data?: ArticleSummary[];
        pagination?: { total?: number };
        user?: { name?: string };
      };

      if (fetchId && res.user) setUserName(res.user.name ?? "");

      return { data: res.data ?? [], total: res.pagination?.total ?? 0 };
    },
    [],
  );

  const {
    rows: articles,
    total,
    isLoading: loading,
    isFetchingMore,
    hasMore,
    error,
    fetchMore,
    refetchLoaded,
  } = useInfiniteTableData<ArticleSummary, ArticlesPageParams>({
    fetchPage: fetchArticlesPage,
    params: {
      id,
      viewAll,
      month: viewAll ? undefined : selectedMonthKey,
      status: selectedStatus,
      type: selectedType,
    },
    limit: FETCH_LIMIT,
  });

  // Poll while any currently-loaded article is still being (re-)evaluated —
  // e.g. just triggered from the row action — so the table reflects the
  // result without a manual refresh. Per-row cap: each row gets its own 90s
  // clock from the moment it's first seen pending, tracked in a plain Map
  // rather than N separate timers (there's one list-level fetch either way,
  // so per-row "polling" really means "does this row still count towards
  // the shared refetch"). A single mount-long interval reads that bookkeeping
  // fresh each tick, so there's no dependency-driven teardown/rebuild that
  // could leave a stale interval running or miss a resolution.
  const isRowPending = (a: ArticleSummary) =>
    a.status === "pending" || (a.ai_score === null && a.status !== "failed");

  const [isPolling, setIsPolling] = useState(false);
  const [timedOutIds, setTimedOutIds] = useState<Set<string>>(new Set());
  const timedOutIdsRef = useRef(timedOutIds);
  timedOutIdsRef.current = timedOutIds;
  // First-seen-pending timestamp per row id — each row's own 90s cap counts
  // down from here, independent of every other row's.
  const pendingStartRef = useRef<Map<string, number>>(new Map());
  const refetchLoadedRef = useRef(refetchLoaded);
  refetchLoadedRef.current = refetchLoaded;

  // Reconcile bookkeeping whenever the loaded rows change: start the clock
  // for newly-pending rows, and drop rows that resolved or that a filter/
  // sort change scrolled out of the loaded set — nothing leaks past that.
  useEffect(() => {
    const stillPendingIds = new Set<string>();

    for (const a of articles) {
      if (isRowPending(a)) {
        stillPendingIds.add(a.id);
        if (!pendingStartRef.current.has(a.id)) {
          pendingStartRef.current.set(a.id, Date.now());
        }
      }
    }

    for (const id of Array.from(pendingStartRef.current.keys())) {
      if (!stillPendingIds.has(id)) pendingStartRef.current.delete(id);
    }

    setTimedOutIds((prev) => {
      if (prev.size === 0) return prev;
      let mutated = false;
      const next = new Set(prev);
      for (const id of prev) {
        if (!stillPendingIds.has(id)) {
          next.delete(id);
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [articles]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;

      const now = Date.now();
      const newlyTimedOut: string[] = [];
      for (const [id, startedAt] of pendingStartRef.current) {
        if (now - startedAt > ROW_TIMEOUT_MS && !timedOutIdsRef.current.has(id)) {
          newlyTimedOut.push(id);
        }
      }
      if (newlyTimedOut.length > 0) {
        setTimedOutIds((prev) => {
          const next = new Set(prev);
          newlyTimedOut.forEach((id) => next.add(id));
          return next;
        });
      }

      const worthPolling = Array.from(pendingStartRef.current.keys()).some(
        (id) => !timedOutIdsRef.current.has(id) && !newlyTimedOut.includes(id),
      );

      if (!worthPolling) {
        setIsPolling(false);
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

  // Manual "check again" for a row that gave up — restarts its own 90s
  // clock and checks current server state right away.
  const handleCheckAgain = useCallback((articleId: string) => {
    pendingStartRef.current.set(articleId, Date.now());
    setTimedOutIds((prev) => {
      if (!prev.has(articleId)) return prev;
      const next = new Set(prev);
      next.delete(articleId);
      return next;
    });
    refetchLoadedRef.current({ silent: true });
  }, []);

  const filteredByAuthor = useMemo(() => {
    if (selectedAuthor === "all") return articles;
    return articles.filter((a) => a.author_name === selectedAuthor);
  }, [articles, selectedAuthor]);

  const displayedArticles = useMemo(() => {
    const sorted = [...filteredByAuthor];

    switch (sortBy) {
      case "score_desc":
        sorted.sort((a, b) => (b.ai_score ?? -1) - (a.ai_score ?? -1));
        break;
      case "score_asc":
        sorted.sort((a, b) => (a.ai_score ?? -1) - (b.ai_score ?? -1));
        break;
      case "version_desc":
        sorted.sort((a, b) => b.version - a.version);
        break;
      case "version_asc":
        sorted.sort((a, b) => a.version - b.version);
        break;
      case "created_asc":
        sorted.sort(
          (a, b) =>
            new Date(a.submitted_at).getTime() -
            new Date(b.submitted_at).getTime(),
        );
        break;
      case "created_desc":
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.submitted_at).getTime() -
            new Date(a.submitted_at).getTime(),
        );
        break;
    }

    return sorted;
  }, [filteredByAuthor, sortBy]);

  const isUserView = Boolean(id);
  return (
    <PageShell>
      {isUserView && (
        <button
          onClick={() =>
            window.history.length > 1 ? navigate(-1) : navigate("/admin/users")
          }
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ChevronLeft size={14} />
          Back to Users
        </button>
      )}

      <div className="flex justify-between">
        <PageHeader
          title={id ? `${userName || "User"}'s articles` : "All articles"}
        />

        <Button
          type="button"
          size="lg"
          onClick={() => navigate("/articles/new")}
        >
          <Plus size={16} />
          New article
        </Button>
      </div>

      <FilterToolbar
        className={
          isUserView
            ? "grid grid-cols-2 gap-3 sm:grid-cols-5"
            : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        }
      >

        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-pressed={viewAll}
          className="h-9 border-border bg-white text-slate-600"
          onClick={() => setViewAll(!viewAll)}
        >
          {viewAll ? "Current month" : "View all"}
        </Button>
        <MonthYearPicker
          label="Month"
          value={selectedMonthKey}
          onChange={(ym) => setFilterParam("month", ym)}
          triggerClassName="w-full"
          disabled={viewAll}
        />
        
        <FilterSelect
          value={selectedType}
          onValueChange={(value) => setFilterParam("type", value, "all")}
          placeholder="All types"
          aria-label="Article type"
          options={[
            { value: "all", label: "All types" },
            ...articleTypes.map((type) => ({
              value: type.id,
              label: type.name,
            })),
          ]}
        />
        <FilterSelect
          value={selectedStatus}
          onValueChange={(value) => setFilterParam("status", value, "all")}
          placeholder="All statuses"
          aria-label="Status"
          options={STATUS_OPTIONS}
        />
        <FilterSelect
          value={sortBy}
          onValueChange={(value) =>
            setFilterParam("sort", value, "created_desc")
          }
          placeholder="Sort"
          aria-label="Sort"
          options={[
            { value: "created_desc", label: "Created (newest first)" },
            { value: "created_asc", label: "Created (oldest first)" },
            { value: "score_desc", label: "AI score (high → low)" },
            { value: "score_asc", label: "AI score (low → high)" },
            { value: "version_desc", label: "Version (high → low)" },
            { value: "version_asc", label: "Version (low → high)" },
          ]}
        />
        {!isUserView && (
          <FilterSelect
            value={selectedAuthor}
            onValueChange={(value) => setFilterParam("author", value, "all")}
            placeholder="All authors"
            aria-label="Author"
            options={[
              { value: "all", label: "All authors" },
              ...authors.map((name) => ({ value: name, label: name })),
            ]}
          />
        )}
      </FilterToolbar>

      {isPolling && (
        <InlineAlert variant="warning" role="status">
          <span className="inline-flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" aria-hidden />
            Re-evaluation in progress — auto-refreshing…
          </span>
        </InlineAlert>
      )}

      {error ? (
        <InlineAlert>{error}</InlineAlert>
      ) : loading ? (
        <DataGridSkeleton rows={8} />
      ) : (
        <>
          <ArticlesTable
            // The server total ignores the author filter (client-side only) —
            // once one's selected, fall back to the filtered count instead of
            // showing a stale, filter-blind number.
            totalCount={selectedAuthor === "all" ? total : undefined}
            articles={displayedArticles}
            onRowClick={(articleId: string) => {
              // AdminArticleDetail has no rewrite flow — an admin viewing
              // their own article needs the user-side detail page instead.
              const clicked = articles.find((a) => a.id === articleId);
              if (currentUser && clicked?.user_id === currentUser.id) {
                navigate(`/articles/${articleId}`);
              } else {
                navigate(`/admin/articles/${articleId}`);
              }
            }}
            onFetchMore={fetchMore}
            isFetchingMore={isFetchingMore}
            hasMore={hasMore}
            onReevaluated={() => refetchLoaded({ silent: true })}
            timedOutIds={timedOutIds}
            onCheckAgain={handleCheckAgain}
          />
        </>
      )}
    </PageShell>
  );
};

export default AllArticles;
