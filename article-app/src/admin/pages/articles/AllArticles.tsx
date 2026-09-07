import { useCallback, useEffect, useMemo, useState } from "react";
import ArticlesTable from "../../components/articles/ArticlesTable";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { api, tokenStorage } from "@/http-client";

import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ArticleSummary } from "@/admin/utils/types";

const BACKEND_URL = ((import.meta.env.VITE_BACKEND_URL as string | undefined) || "").replace(/\/$/, "");

type ArticleTypeOption = {
  id: string;
  name: string;
};

const STATUS_OPTIONS = [
  {
    value: "all",
    label: "All Statuses",
  },
  {
    value: "approved",
    label: "Accepted",
  },
  {
    value: "pending",
    label: "Pending",
  },
  {
    value: "rewrite_required",
    label: "Rejected",
  },
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
  const selectedMonth: Dayjs = dayjs(`${selectedMonthKey}-01`).startOf("month");
  const focusedYear = Number(searchParams.get("year")) || selectedMonth.year();
  const selectedStatus = searchParams.get("status") || "all";
  const selectedType = searchParams.get("type") || "all";
  const selectedAuthor = searchParams.get("author") || "all";
  const sortBy = searchParams.get("sort") || "created_desc";
  const [authors, setAuthors] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

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
      const response = await api<
        Array<{
          id: string;
          name: string;
        }>
      >("/article-types");

      setArticleTypes(
        response.map((type) => ({
          id: type.id,
          name: type.name,
        })),
      );
    } catch (err) {
      console.error("Failed to load article types:", err);
    }
  }, []);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      // Always send month.
      params.set("month", selectedMonthKey);

      if (selectedStatus !== "all") {
        params.set("status", selectedStatus);
      }

      if (selectedType !== "all") {
        params.set("type", selectedType);
      }

      const base = BACKEND_URL;
      const endpoint = id
        ? `${base}/api/users/${id}/articles?${params.toString()}`
        : `${base}/api/articles?${params.toString()}`;

      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${tokenStorage.get()}`
        }
      });

      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await res.text();
        throw new Error(`Unexpected response (${res.status}): ${text.slice(0, 200)}`);
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || `Failed to fetch articles (${res.status})`);
      }

      const json = await res.json();

      if (json.user) {
        setUserName(json.user.name ?? "");
      }

      setArticles(json.data ?? []);
    } catch (err) {
      console.error("Failed to load articles:", err);

      setError(err instanceof Error ? err.message : "Failed to load articles");

      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [id, selectedMonthKey, selectedStatus, selectedType]);

  useEffect(() => {
    fetchArticleTypes();
  }, [fetchArticleTypes]);

  useEffect(() => {
    const names = Array.from(
      new Set(articles.map((a) => a.author_name).filter(Boolean)),
    );
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
    <div className="w-full px-4 md:px-8 py-5">
      {isUserView && (
        <button
          onClick={() =>
            window.history.length > 1 ? navigate(-1) : navigate("/admin/users")
          }
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft size={14} /> Back to Users
        </button>
      )}
      <div className="mb-5">
        <h1 className="text-3xl font-semibold text-slate-900">
          {id ? `${userName || "User"}'s Articles` : "All Articles"}
        </h1>
      </div>

      {/* Filters - hide author dropdown in user view */}
      <div
        className={`grid gap-3 mb-5 ${isUserView ? "grid-cols-4" : "grid-cols-5"}`}
      >
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="justify-between font-normal w-full h-9 bg-white border border-slate-300 rounded-lg text-sm shadow-none"
            >
              {selectedMonth.format("MMMM YYYY")}
              <Calendar className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-64 p-3">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost"
                className="h-7 w-7 p-0 opacity-50 hover:opacity-100"
                onClick={() => setFilterParam("year", String(focusedYear - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="font-bold text-sm">{focusedYear}</div>

              <Button
                variant="ghost"
                className="h-7 w-7 p-0 opacity-50 hover:opacity-100"
                onClick={() => setFilterParam("year", String(focusedYear + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }).map((_, i) => {
                const month = dayjs()
                  .year(focusedYear)
                  .month(i)
                  .startOf("month");

                const isSelected =
                  selectedMonth.format("YYYY-MM") === month.format("YYYY-MM");

                const isCurrent =
                  dayjs().format("YYYY-MM") === month.format("YYYY-MM");

                return (
                  <Button
                    key={i}
                    variant={isSelected ? "default" : "ghost"}
                    onClick={() => setFilterParam("month", month.format("YYYY-MM"))}
                    className={`h-9 text-sm ${
                      isSelected
                        ? ""
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {month.format("MMM")}
                    {isCurrent && (
                      <span className="absolute top-1 right-1 h-1 w-1 rounded-full bg-primary" />
                    )}
                  </Button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <Select
          value={selectedType}
          onChange={(value) => setFilterParam("type", value, "all")}
          showSearch
          optionFilterProp="label"
          placeholder="All Types"
          className="w-full h-9 [&_.ant-select-selector]:!bg-white [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-slate-300 [&_.ant-select-selector]:!h-9 text-sm"
            styles={{
            popup: {
              root: { background: "#fff" },
            },
          }}
          listHeight={192}
          options={[
            { value: "all", label: "All Types" },
            ...articleTypes.map((type) => ({
              value: type.id,
              label: type.name,
            })),
          ]}
          filterOption={(input, opt) =>
            (opt?.label as string).toLowerCase().includes(input.toLowerCase())
          }
        />
        <Select
          value={selectedStatus}
          onChange={(value) => setFilterParam("status", value, "all")}
          showSearch
          optionFilterProp="label"
          placeholder="All Statuses"
          className="w-full h-9 [&_.ant-select-selector]:!bg-white [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-slate-300 [&_.ant-select-selector]:!h-9 text-sm"
          styles={{
            popup: {
              root: { background: "#fff" },
            },
          }}
          listHeight={192}
          options={STATUS_OPTIONS}
          filterOption={(input, opt) =>
            (opt?.label as string).toLowerCase().includes(input.toLowerCase())
          }
        />
        <Select
          value={sortBy}
          onChange={(value) => setFilterParam("sort", value, "created_desc")}
          showSearch
          optionFilterProp="label"
          placeholder="Sort"
          className="w-full h-9 [&_.ant-select-selector]:!bg-white [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-slate-300 [&_.ant-select-selector]:!h-9 text-sm"
          styles={{
            popup: {
              root: { background: "#fff" },
            },
          }}
          listHeight={192}
          options={[
            { value: "created_desc", label: "Created (Newest First)" },
            { value: "created_asc", label: "Created (Oldest First)" },
            { value: "score_desc", label: "AI Score (High → Low)" },
            { value: "score_asc", label: "AI Score (Low → High)" },
            { value: "version_desc", label: "Version (High → Low)" },
            { value: "version_asc", label: "Version (Low → High)" },
          ]}
          filterOption={(input, opt) =>
            (opt?.label as string).toLowerCase().includes(input.toLowerCase())
          }
        />
        {!isUserView && (
          <Select
            value={selectedAuthor}
            onChange={(value) => setFilterParam("author", value, "all")}
            showSearch
            optionFilterProp="label"
            placeholder="All Authors"
            className="w-full h-9 [&_.ant-select-selector]:!bg-white [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-slate-300 [&_.ant-select-selector]:!h-9 text-sm"
            styles={{
              popup: {
                root: { background: "#fff" },
              },
            }}
            listHeight={192}
            options={[
              { value: "all", label: "All Authors" },
              ...authors.map((name) => ({ value: name, label: name })),
            ]}
            filterOption={(input, opt) =>
              (opt?.label as string).toLowerCase().includes(input.toLowerCase())
            }
            notFoundContent="No authors found"
          />
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Loading articles
        </div>
      ) : (
        <ArticlesTable
          articles={displayedArticles}
          onRowClick={(articleId) => navigate(`/admin/articles/${articleId}`)}
        />
      )}
    </div>
  );
};

export default AllArticles;
