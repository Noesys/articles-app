import { useCallback, useEffect, useMemo, useState } from "react";
import ArticlesTable from "../../components/articles/ArticlesTable";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import { api, apiFull } from "@/http-client";

import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { SimplePagination } from "@/components/ui/simple-pagination";
import { ArticleSummary } from "@/admin/utils/types";
import { PageHeader, PageShell, FilterToolbar } from "@/components/page-chrome";
import { MonthYearPicker } from "@/admin/components/ui/MonthYearPicker";
import { InlineAlert } from "@/components/ui/inline-alert";
import { DataGridSkeleton } from "@/components/ui/data-grid-skeleton";

type ArticleTypeOption = {
  id: string;
  name: string;
};

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Accepted" },
  { value: "pending", label: "Pending" },
  { value: "rewrite_required", label: "Rejected" },
];

const AllArticles = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [articleTypes, setArticleTypes] = useState<ArticleTypeOption[]>([]);
  const [userName, setUserName] = useState("");

  const monthParam = searchParams.get("month");
  const selectedMonthKey =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) && dayjs(`${monthParam}-01`).isValid()
      ? monthParam
      : dayjs().format("YYYY-MM");
  const selectedStatus = searchParams.get("status") || "all";
  const selectedType = searchParams.get("type") || "all";
  const selectedAuthor = searchParams.get("author") || "all";
  const sortBy = searchParams.get("sort") || "created_desc";
  const [authors, setAuthors] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  const setFilterParam = (name: string, value: string, defaultValue?: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === defaultValue) next.delete(name);
      else next.set(name, value);
      return next;
    });
  };

  const fetchArticleTypes = useCallback(async () => {
    try {
      const response = await api<Array<{ id: string; name: string }>>("/admin/article-types");
      setArticleTypes(response.map((type) => ({ id: type.id, name: type.name })));
    } catch (err) {
      console.error("Failed to load article types:", err);
    }
  }, []);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("month", selectedMonthKey);
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (selectedStatus !== "all") params.set("status", selectedStatus);
      if (selectedType !== "all") params.set("type", selectedType);

      const path = id
        ? `/admin/users/${id}/articles?${params.toString()}`
        : `/admin/articles?${params.toString()}`;
      if (id) {
        const res: any = await apiFull(path);
        if (res?.user) setUserName(res.user.name ?? "");
        const body: any = res as any;
        setArticles(body.data ?? []);
        if (body.user) setUserName(body.user.name ?? "");
        if (body.pagination) setTotal(body.pagination.total ?? 0);
      } else {
        const res: any = await apiFull<ArticleSummary[]>(path);
        setArticles(res.data ?? []);
        if (res.pagination) setTotal(res.pagination.total ?? 0);
      }
    } catch (err) {
      console.error("Failed to load articles:", err);
      setError(err instanceof Error ? err.message : "Failed to load articles");
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [id, selectedMonthKey, selectedStatus, selectedType, page]);

  useEffect(() => {
    fetchArticleTypes();
  }, [fetchArticleTypes]);

  useEffect(() => {
    const names = Array.from(new Set(articles.map((a) => a.author_name).filter(Boolean)));
    setAuthors(names.sort((a, b) => a.localeCompare(b)));
  }, [articles]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

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
          (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime(),
        );
        break;
      case "created_desc":
      default:
        sorted.sort(
          (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
        );
        break;
    }

    return sorted;
  }, [filteredByAuthor, sortBy]);

  const isUserView = Boolean(id);
  return (
    <PageShell>
      {isUserView && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/admin/users"))}
          className="mb-3 -ml-2 text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft size={14} /> Back to Users
        </Button>
      )}
      <PageHeader
        title={id ? `${userName || "User"}'s articles` : "All articles"}
        subtitle={!loading && !error ? `${total} total` : undefined}
      />

      <FilterToolbar className={isUserView ? "grid grid-cols-2 gap-3 sm:grid-cols-4" : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"}>
        <MonthYearPicker
          label="Month"
          value={selectedMonthKey}
          onChange={(ym) => setFilterParam("month", ym)}
          triggerClassName="w-full"
        />
        <FilterSelect
          value={selectedType}
          onValueChange={(value) => setFilterParam("type", value, "all")}
          placeholder="All types"
          aria-label="Article type"
          options={[
            { value: "all", label: "All types" },
            ...articleTypes.map((type) => ({ value: type.id, label: type.name })),
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
          onValueChange={(value) => setFilterParam("sort", value, "created_desc")}
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

      {error ? (
        <InlineAlert>{error}</InlineAlert>
      ) : loading ? (
        <DataGridSkeleton rows={8} />
      ) : (
        <>
          <ArticlesTable
            totalCount={total}
            articles={displayedArticles}
            onRowClick={(articleId: string) => navigate(`/admin/articles/${articleId}`)}
          />
          {total > limit && (
            <div className="mt-4 flex justify-end">
              <SimplePagination page={page} total={total} pageSize={limit} onChange={setPage} />
            </div>
          )}
        </>
      )}
    </PageShell>
  );
};

export default AllArticles;
