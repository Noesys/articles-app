import Header from "../components/Header";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpen, CalendarDays, Loader2, Tag, User } from "lucide-react";
import dayjs from "dayjs";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell, FilterToolbar } from "@/components/page-chrome";
import { InlineAlert } from "@/components/ui/inline-alert";
import EmptyState from "@/admin/components/ui/EmptyState";
import ArticleViewer from "@/components/shadcnEditor/ArticleViewer";
import { api, apiFull } from "@/http-client";
import { cn } from "@/lib/utils";

type BrowseItem = {
  id: string;
  title: string;
  excerpt: string;
  article_type_id: string;
  article_type_name: string;
  author_name: string;
  month_year: string;
  submitted_at: string;
};

type TypeCount = { id: string; name: string; count: number };

type BrowseResponse = {
  data: BrowseItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  meta: { typeCounts: TypeCount[] };
};

type BrowseDetail = {
  id: string;
  title: string;
  content: string;
  article_type_id: string;
  article_type_name: string;
  author_name: string;
  month_year: string;
  submitted_at: string;
};

function formatMonth(monthYear: string): string {
  const d = dayjs(`${monthYear}-01`);
  return d.isValid() ? d.format("MMMM YYYY") : monthYear;
}

function MetaLine({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className="text-slate-400">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}

export function formatBrowseMonth(monthYear: string): string {
  return formatMonth(monthYear);
}

export default function ExploreArticles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [typeCounts, setTypeCounts] = useState<TypeCount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeType = searchParams.get("type") || "all";
  const sort = searchParams.get("sort") === "earliest" ? "earliest" : "latest";

  const setParam = (name: string, value: string, defaultValue?: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === defaultValue) next.delete(name);
      else next.set(name, value);
      return next;
    });
  };

  useEffect(() => {
    setPage(1);
  }, [activeType, sort]);

  useEffect(() => {
    let cancelled = false;
    const first = page === 1;
    if (first) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    const params = new URLSearchParams();
    if (activeType !== "all") params.set("type", activeType);
    params.set("sort", sort);
    params.set("page", String(page));
    params.set("limit", "9");
    apiFull<BrowseItem[]>(`/articles/browse?${params.toString()}`)
      .then((full) => {
        if (cancelled) return;
        const body = full as unknown as BrowseResponse;
        setItems((prev) => (first ? body.data : [...prev, ...body.data]));
        if (body.pagination) {
          setTotal(body.pagination.total);
          setTotalPages(body.pagination.totalPages);
        }
        if (body.meta) setTypeCounts(body.meta.typeCounts);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load articles");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType, sort, page]);

  const hasMore = page < totalPages;

  return (
    <div className="h-full bg-[#f3f4f6]">
      {user?.auth_role === "user" && <Header />}
      <PageShell>
        <PageHeader
          title="Explore articles"
          subtitle={!loading ? `${total} ${total === 1 ? "article" : "articles"}` : undefined}
          actions={
            <Button type="button" variant="outline" size="lg" onClick={() => navigate("/")}>
              <BookOpen size={16} />
              My articles
            </Button>
          }
        />

        <FilterToolbar>
          <FilterSelect
            value={sort}
            onValueChange={(value) => setParam("sort", value, "latest")}
            aria-label="Sort order"
            className="w-[200px]"
            options={[
              { value: "latest", label: "Latest first" },
              { value: "earliest", label: "Earliest first" },
            ]}
          />
        </FilterToolbar>

        {typeCounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setParam("type", "all", "all")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors outline-none",
                activeType === "all"
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "border-border bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              <Tag size={13} />
              All
              <span className={cn("text-xs", activeType === "all" ? "text-teal-100" : "text-slate-400")}>
                {total}
              </span>
            </button>
            {typeCounts.map((t) => {
              const active = activeType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setParam("type", active ? "all" : t.id, "all")}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors outline-none",
                    active
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-border bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {t.name}
                  <span className={cn("text-xs", active ? "text-teal-100" : "text-slate-400")}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {error && <InlineAlert>{error}</InlineAlert>}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={22} />}
            title="No articles yet"
            description="Articles submitted by the team will appear here."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((a) => (
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
                  <span className="text-base font-semibold leading-snug text-slate-900 line-clamp-2">
                    {a.title}
                  </span>
                  {a.excerpt && (
                    <span className="mt-2 text-sm leading-relaxed text-slate-500 line-clamp-3">
                      {a.excerpt}
                    </span>
                  )}
                  <span className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3">
                    <MetaLine icon={<User size={13} />}>{a.author_name}</MetaLine>
                    <MetaLine icon={<CalendarDays size={13} />}>{formatMonth(a.month_year)}</MetaLine>
                  </span>
                </button>
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={loadingMore}
                  onClick={() => setPage((p) => p + 1)}
                  className="border-border bg-white"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
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
      {user?.auth_role === "user" && <Header />}
      <PageShell>
        <div className="mb-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/explore")}>
            <ArrowLeft size={15} />
            Back to explore
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : error || !article ? (
          <InlineAlert>{error ?? "Article not found"}</InlineAlert>
        ) : (
          <article className="mx-auto w-full max-w-3xl rounded-sm border border-slate-200 bg-white px-6 py-8 shadow-[var(--shadow-card)] md:px-10">
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
              <MetaLine icon={<CalendarDays size={14} />}>{formatMonth(article.month_year)}</MetaLine>
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
