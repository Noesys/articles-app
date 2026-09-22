import Header from "../components/Header";
import AdminHeader from "@/admin/components/AdminHeader";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, CalendarDays, ChevronLeft, Loader2, Search, User } from "lucide-react";
import dayjs from "dayjs";
import { useAuth } from "../contexts/AuthContext";
import { FilterSelect } from "@/components/ui/filter-select";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell, FilterToolbar } from "@/components/page-chrome";
import { InlineAlert } from "@/components/ui/inline-alert";
import EmptyState from "@/admin/components/ui/EmptyState";
import ArticleViewer from "@/components/shadcnEditor/ArticleViewer";
import { api, apiFull } from "@/http-client";
import { useInfiniteTableData } from "@/hooks/useInfiniteTableData";
import { getSavedScrollPosition } from "@/utils/ScrollManager";

type BrowseItem = {
  id: string;
  title: string;
  article_type_id: string;
  article_type_name: string;
  author_name: string;
  submitted_at: string;
};

type ArticleTypeOption = { id: string; name: string };

type BrowseResponse = {
  data: BrowseItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  meta: { typeOptions: ArticleTypeOption[] };
};

type BrowseDetail = {
  id: string;
  title: string;
  content: string;
  article_type_id: string;
  article_type_name: string;
  author_name: string;
  submitted_at: string;
};

const LIMIT = 9;
const SEARCH_DEBOUNCE_MS = 350;

function formatDate(dateStr: string): string {
  const d = dayjs(dateStr);
  return d.isValid() ? d.format("MMM D, YYYY") : dateStr;
}

// Matches ArticleDetail.tsx's navigateBackOrToArticles — browser-back when
// there's history to go back to (preserving the list's state/scroll via
// ScrollManager), falling back to a fresh /explore for a direct URL visit.
function navigateBackOrToExplore(navigate: ReturnType<typeof useNavigate>) {
  if (window.history.length > 1) navigate(-1);
  else navigate("/explore");
}

function MetaLine({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className="text-slate-400">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

export default function ExploreArticles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [typeOptions, setTypeOptions] = useState<ArticleTypeOption[]>([]);

  const activeType = searchParams.get("type") || "all";
  const activeQuery = searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(activeQuery);

  // The search box updates immediately; the URL param (and therefore the
  // fetch) is debounced. Skips its own first run so returning here via
  // browser-back doesn't immediately strip the restored "count" param below.
  const isFirstSearchRun = useRef(true);
  useEffect(() => {
    if (isFirstSearchRun.current) {
      isFirstSearchRun.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (searchInput.trim()) next.set("q", searchInput.trim());
          else next.delete("q");
          next.delete("count");
          return next;
        },
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const setType = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (!value || value === "all") next.delete("type");
        else next.set("type", value);
        next.delete("count");
        return next;
      },
      { replace: true },
    );
  };

  const fetchExplorePage = useCallback(
    async ({
      page,
      limit,
      type,
      q,
    }: {
      page: number;
      limit: number;
      type: string;
      q: string;
    }) => {
      const params = new URLSearchParams();
      if (type !== "all") params.set("type", type);
      if (q) params.set("q", q);
      params.set("page", String(page));
      params.set("limit", String(limit));
      const full = (await apiFull<BrowseItem[]>(
        `/articles/browse?${params.toString()}`,
      )) as unknown as BrowseResponse;
      if (full.meta?.typeOptions) setTypeOptions(full.meta.typeOptions);
      return { data: full.data ?? [], total: full.pagination?.total ?? 0 };
    },
    [],
  );

  const { rows, total, isLoading, isFetchingMore, hasMore, error, fetchMore } =
    useInfiniteTableData<BrowseItem, { type: string; q: string }>({
      fetchPage: fetchExplorePage,
      params: { type: activeType, q: activeQuery },
      limit: LIMIT,
    });

  // Preserve list position: replay however many pages were loaded before the
  // user left, read once from the URL on mount. Keeps the URL's own "count"
  // in sync as more pages load so leaving again captures the right depth.
  const location = useLocation();
  const restoreKeyRef = useRef(location.pathname + location.search);
  const restoreTargetRef = useRef(
    Math.max(1, parseInt(searchParams.get("count") || "1", 10) || 1),
  );
  const restoreDoneRef = useRef(false);

  useEffect(() => {
    if (restoreDoneRef.current || isLoading) return;
    const loadedPages = Math.max(1, Math.ceil(rows.length / LIMIT));
    if (loadedPages >= restoreTargetRef.current || !hasMore) {
      restoreDoneRef.current = true;
      // ScrollManager's own restore already ran on mount, before this
      // content existed to scroll into (async replay above). Re-apply it
      // now that the page is (approximately) as tall as it was when the
      // user left, using the same pathname+search key it stored under.
      const savedY = getSavedScrollPosition(restoreKeyRef.current);
      if (savedY !== undefined) {
        requestAnimationFrame(() => window.scrollTo(0, savedY));
      }
      return;
    }
    if (!isFetchingMore) fetchMore();
  }, [isLoading, isFetchingMore, rows.length, hasMore, fetchMore]);

  useEffect(() => {
    const loadedPages = Math.max(1, Math.ceil(rows.length / LIMIT));
    const current = searchParams.get("count");
    const next = loadedPages > 1 ? String(loadedPages) : null;
    if (next === current) return;
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next) p.set("count", next);
        else p.delete("count");
        return p;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  // Page-scroll infinite loading: fetch the next page when the sentinel below
  // the list comes within 400px of the viewport. The observer is recreated
  // after every load so a sentinel that is still on-screen (short page) fires
  // again. Skipped after an error so a failing request doesn't retry in a loop.
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el || !hasMore || isFetchingMore || error) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) fetchMore();
      },
      { rootMargin: "0px 0px 400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, rows.length, error, fetchMore]);

  const hasActiveFilters = Boolean(activeQuery || activeType !== "all");

  return (
    <div className="h-full bg-[#f3f4f6]">
      {user?.auth_role === "user" ? <Header /> : <AdminHeader />}
      <PageShell>
        <PageHeader
          title="Explore articles"
          subtitle={!isLoading ? `${total} ${total === 1 ? "article" : "articles"}` : "loading..."}
        />

        <FilterToolbar>
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:w-[70%]">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by title or author..."
                aria-label="Search articles"
                className="w-full rounded-sm border border-border bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-teal-500/40"
              />
            </div>
            <div className="w-full sm:w-[30%]">
              <FilterSelect
                value={activeType}
                onValueChange={setType}
                placeholder="All types"
                aria-label="Article type"
                options={[
                  { value: "all", label: "All types" },
                  ...typeOptions.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            </div>
          </div>
        </FilterToolbar>

        {error && <InlineAlert>{error}</InlineAlert>}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={22} />}
            title={hasActiveFilters ? "No matches" : "No articles yet"}
            description={
              hasActiveFilters
                ? "Try a different search term or article type."
                : "Accepted articles from the team will appear here."
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => navigate(`/explore/${a.id}`)}
                  className="flex flex-col rounded-sm border border-slate-200 bg-white p-5 text-left shadow-[var(--shadow-card)] transition-[box-shadow,border-color] duration-[var(--duration-fast)] hover:border-teal-200 hover:shadow-[var(--shadow-overlay)] outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
                >
                  <Badge
                    variant="outline"
                    className="mb-3 self-start border-transparent bg-teal-50 font-medium text-teal-700 ring-1 ring-teal-200/60"
                  >
                    {a.article_type_name}
                  </Badge>
                  <span className="min-h-[2.75rem] text-base font-semibold leading-snug text-slate-900 line-clamp-2">
                    {a.title}
                  </span>
                  <span className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3">
                    <MetaLine icon={<User size={13} />}>{a.author_name}</MetaLine>
                    <MetaLine icon={<CalendarDays size={13} />}>
                      {formatDate(a.submitted_at)}
                    </MetaLine>
                  </span>
                </button>
              ))}
            </div>
            {hasMore && <div ref={loadMoreSentinelRef} aria-hidden className="h-px" />}
            {isFetchingMore && (
              <div className="flex justify-center py-4" role="status" aria-label="Loading more articles">
                <Loader2 size={22} className="animate-spin text-slate-400" />
              </div>
            )}
          </>
        )}
      </PageShell>
    </div>
  );
}

export function ExploreArticleView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [article, setArticle] = useState<BrowseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<BrowseDetail>(`/articles/browse/${id}`)
      .then((data) => {
        if (!cancelled) setArticle(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load article");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="h-full bg-[#f3f4f6]">
      {user?.auth_role === "user" ? <Header /> : <AdminHeader />}
      <PageShell>
        {/* Browser-back (not a hardcoded /explore URL) so the prior search,
            type filter, loaded page count, and scroll position — all kept
            in that URL — are restored exactly as the app's existing
            ScrollManager already does for POP navigation. Style matches
            ArticleDetail.tsx's own back button exactly. */}
        <button
          onClick={() => navigateBackOrToExplore(navigate)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ChevronLeft size={14} />
          Back
        </button>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : error || !article ? (
          <InlineAlert>{error ?? "Article not found"}</InlineAlert>
        ) : (
          <article className="w-full rounded-sm border border-slate-200 bg-white px-6 py-8 shadow-[var(--shadow-card)] md:px-10">
            <Badge
              variant="outline"
              className="mb-4 border-transparent bg-teal-50 font-medium text-teal-700 ring-1 ring-teal-200/60"
            >
              {article.article_type_name}
            </Badge>
            <h1 className="text-2xl font-bold leading-tight text-slate-900 md:text-3xl">
              {article.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-slate-100 pb-5">
              <MetaLine icon={<User size={14} />}>
                <span className="font-medium text-slate-700">{article.author_name}</span>
              </MetaLine>
              <MetaLine icon={<CalendarDays size={14} />}>
                {formatDate(article.submitted_at)}
              </MetaLine>
            </div>
            <div className="pt-5">
              <ArticleViewer content={article.content} />
            </div>
          </article>
        )}
      </PageShell>
    </div>
  );
}
