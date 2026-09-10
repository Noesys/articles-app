import Header from "../components/Header";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, ChevronLeft, ChevronRight, Calendar, Loader2 } from "lucide-react";
import dayjs from "dayjs";
import { useMyArticles } from "../hooks/useMyArticles";
import { useAuth } from "../contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import {
  ColumnDef,
  PaginationState,
  SortingState,
  useTable,
} from "@tanstack/react-table";
import { api } from "@/http-client";
import { ArticleListItem } from "@/utils/types";
import {
  contiqTableContainerClassName,
  contiqTableClassNames,
  contiqTableLayout,
} from "@/admin/utils/contiq-data-grid";
import { cn } from "@/lib/utils";

type ArticleStatus = "accepted" | "rejected" | "scoring";

const STATUS_CONFIG: Record<string, { className: string; label: string }> = {
  accepted: {
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80 border-transparent",
    label: "Accepted",
  },
  rejected: {
    className: "bg-red-50 text-red-600 ring-1 ring-red-200/80 border-transparent",
    label: "Rejected",
  },
  scoring: {
    className: "bg-slate-50 text-slate-600 ring-1 ring-slate-200/80 border-transparent",
    label: "Scoring...",
  },
};

function getDisplayStatus(article: { status: string; ai_score: number | null }): {
  key: ArticleStatus;
  label: string;
  className: string;
} {
  if (article.status === "failed") {
    return {
      key: "rejected",
      label: "Failed",
      className: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/80 border-transparent",
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
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth;
  const focusedYear = Number(searchParams.get("year")) || Number(month.slice(0, 4));
  const viewAll = searchParams.get("viewAll") === "true";
  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const typeFilter = searchParams.get("type") || "all";
  const statusFilter = searchParams.get("status") || "all";
  const setFilterParam = (name: string, value: string, defaultValue?: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === defaultValue) next.delete(name);
      else next.set(name, value);
      return next;
    });
  };
  const [articleTypes, setArticleTypes] = useState<{ id: string; name: string }[]>([]);
  const [typesError, setTypesError] = useState<string | null>(null);

  useEffect(() => {
    api<{ id: string; name: string }[]>("/article-types")
      .then(setArticleTypes)
      .catch((err) => setTypesError(err instanceof Error ? err.message : "Failed to load types"));
  }, []);

  const { articles, loading, error, pagination, isPolling, refetch } = useMyArticles({
    month: viewAll ? undefined : month,
    viewAll,
    page: viewAll ? currentPage : undefined,
    limit: 10,
  });

  useEffect(() => {
    refetch();
  }, [refetch]);

  const totalPages = pagination.totalPages || 1;

  const filteredArticles = useMemo(() => {
    let out = articles;

    if (typeFilter !== "all") {
      out = out.filter(
        (a) =>
          a.type === typeFilter || articleTypes.find((t) => t.id === typeFilter)?.name === a.type,
      );
    }

    if (statusFilter !== "all") {
      out = out.filter((a) => getDisplayStatus(a).key === statusFilter);
    }

    return out;
  }, [articles, typeFilter, statusFilter, articleTypes]);

  // toast from creation (consume once, clear stale timeout marker on success)
  const [toast, setToast] = useState<string | null>(() => {
    try {
      const t = sessionStorage.getItem("toast");
      const te = sessionStorage.getItem("toastError");
      if (t) {
        sessionStorage.removeItem("toast");
        if (te) sessionStorage.removeItem("toastError");
        return t;
      }
      if (te) {
        sessionStorage.removeItem("toastError");
        return te;
      }
      return null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(id);
    }
    return;
  }, [toast]);

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      {user?.auth_role === "user" && <Header />}

      <div className="w-full px-4 md:px-8 py-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">My Articles</h1>
          </div>
          <button
            onClick={() => navigate("/articles/new")}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            <Plus size={16} />
            New Article
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="justify-between font-normal w-[180px] h-9 bg-white border border-slate-300 rounded-lg text-sm shadow-none"
                disabled={viewAll}
              >
                {dayjs(month).format("MMMM YYYY")}
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
                  const m = dayjs().year(focusedYear).month(i).format("YYYY-MM");
                  const isSelected = month === m;
                  const isCurrent = dayjs().format("YYYY-MM") === m;
                  return (
                    <Button
                      key={i}
                      variant={isSelected ? "default" : "ghost"}
                      onClick={() => setFilterParam("month", m, currentMonth)}
                      className={`h-9 text-sm relative ${isSelected ? "" : "hover:bg-accent hover:text-accent-foreground"}`}
                    >
                      {dayjs().month(i).format("MMM")}
                      {isCurrent && (
                        <span className="absolute top-1 right-1 h-1 w-1 rounded-full bg-primary" />
                      )}
                    </Button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <button
            onClick={() => {
              setSearchParams((current) => {
                const next = new URLSearchParams(current);
                if (viewAll) next.delete("viewAll");
                else next.set("viewAll", "true");
                next.delete("page");
                return next;
              });
            }}
            className="h-9 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg px-3 hover:bg-slate-50 transition-colors"
          >
            {viewAll ? "Current Month" : "View All"}
          </button>

          <FilterSelect
            value={typeFilter}
            onValueChange={(value) => setFilterParam("type", value, "all")}
            placeholder="Filter by Type"
            className="w-[180px]"
            options={[
              { value: "all", label: "All Types" },
              ...articleTypes.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
          <FilterSelect
            value={statusFilter}
            onValueChange={(value) => setFilterParam("status", value, "all")}
            placeholder="Filter by Status"
            className="w-[180px]"
            options={[
              { value: "all", label: "All Status" },
              { value: "accepted", label: "Accepted" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
        </div>

        {typesError && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {typesError}
          </div>
        )}
        {toast && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${toast.toLowerCase().includes("timed out") || toast.toLowerCase().includes("failed") ? "bg-red-50 border-red-200 text-red-600" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}
          >
            {toast}
          </div>
        )}
        {isPolling && (
          <div className="mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" /> Processing your submission —
            auto-refreshing...
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <MyArticlesTable
          articles={filteredArticles}
          loading={loading}
          onRowClick={(id) => navigate(`/articles/${id}`)}
          month={month}
          viewAll={viewAll}
        />

        {viewAll && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-[13.5px] text-slate-700 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterParam("page", String(Math.max(1, currentPage - 1)), "1")}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-400 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() =>
                  setFilterParam("page", String(Math.min(totalPages, currentPage + 1)), "1")
                }
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-400 hover:bg-slate-100 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MyArticlesTable({
  articles,
  loading,
  onRowClick,
  month,
  viewAll,
}: {
  articles: ArticleListItem[];
  loading: boolean;
  onRowClick: (id: string) => void;
  month: string;
  viewAll: boolean;
}) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([{ id: "created", desc: true }]);

  const columns = useMemo<ColumnDef<DataGridFeatures, ArticleListItem>[]>(
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
                  <span className="block truncate font-semibold text-slate-800 text-[13px]">
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
        size: 130,
        cell: ({ getValue }) => (
          <Badge
            variant="outline"
            className="bg-slate-50 text-slate-700 font-medium border-transparent ring-1 ring-slate-200/80"
          >
            {getValue() as string}
          </Badge>
        ),
      },
      {
        accessorKey: "version",
        header: "Version",
        size: 85,
        cell: ({ getValue }) => (
          <span className="text-slate-700 text-[13px]">v{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "ai_score",
        header: "AI Score",
        size: 130,
        cell: ({ row }) => {
          const score = row.original.ai_score;
          if (score === null) return <span className="text-slate-700 text-[13px]">—</span>;
          const classes = getAiScoreClasses(row.original.status);
          return (
            <span className="inline-flex items-center gap-2">
              <Progress
                value={Math.min(Math.max(score, 0), 10) * 10}
                className={cn("w-14 h-1.5", classes.bar)}
              />
              <span className={cn("font-semibold text-[13px]", classes.text)}>{score}</span>
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
            <Badge variant="outline" className={cn("font-medium", cfg.className)}>
              {cfg.label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "created",
        header: "Created",
        size: 125,
        cell: ({ getValue }) => (
          <span className="text-slate-700 text-[13px]">
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
    pageCount: Math.ceil((articles.length || 0) / pagination.pageSize) || 1,
    getRowId: (row) => row.id,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  return (
    <DataGrid
      table={table}
      recordCount={articles.length}
      isLoading={loading}
      onRowClick={(row) => onRowClick(row.id)}
      emptyMessage={
        viewAll ? "No articles found." : `No articles for ${dayjs(month).format("MMMM-YYYY")}.`
      }
      tableLayout={contiqTableLayout}
        tableClassNames={contiqTableClassNames}
    >
      <div className="w-full space-y-2.5">
        <DataGridContainer className={contiqTableContainerClassName}>
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>
        {articles.length > pagination.pageSize && <DataGridPagination />}
      </div>
    </DataGrid>
  );
}
