import Header from "../components/Header";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, ChevronLeft, ChevronRight, Loader2, FileText } from "lucide-react";
import dayjs from "dayjs";
import { useMyArticles } from "../hooks/useMyArticles";
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
import { PageHeader, PageShell, FilterToolbar } from "@/components/page-chrome";
import { MonthYearPicker } from "@/admin/components/ui/MonthYearPicker";
import { InlineAlert } from "@/components/ui/inline-alert";
import EmptyState from "@/admin/components/ui/EmptyState";
import { DataGridSkeleton } from "@/components/ui/data-grid-skeleton";

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
                next.delete("page");
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
            ]}
          />
        </FilterToolbar>

        {typesError && <InlineAlert>{typesError}</InlineAlert>}
        {toast && (
          <InlineAlert
            variant={
              toast.toLowerCase().includes("timed out") || toast.toLowerCase().includes("failed")
                ? "error"
                : "success"
            }
          >
            {toast}
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
          />
        )}

        {viewAll && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Previous page"
                onClick={() => setFilterParam("page", String(Math.max(1, currentPage - 1)), "1")}
                disabled={currentPage === 1}
                className="border-border"
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Next page"
                onClick={() =>
                  setFilterParam("page", String(Math.min(totalPages, currentPage + 1)), "1")
                }
                disabled={currentPage === totalPages}
                className="border-border"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
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
}: {
  articles: ArticleListItem[];
  onRowClick: (id: string) => void;
  month: string;
  viewAll: boolean;
  onCreate: () => void;
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
                  <span className="block truncate text-[13px] font-semibold text-slate-800">
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
            className="border-transparent bg-slate-50 font-medium text-slate-700 ring-1 ring-slate-200/80"
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
          <span className="text-[13px] text-slate-700">v{getValue() as number}</span>
        ),
      },
      {
        accessorKey: "ai_score",
        header: "AI score",
        size: 130,
        cell: ({ row }) => {
          const score = row.original.ai_score;
          if (score === null) return <span className="text-[13px] text-slate-700">—</span>;
          const classes = getAiScoreClasses(row.original.status);
          return (
            <span className="inline-flex items-center gap-2">
              <Progress
                value={Math.min(Math.max(score, 0), 10) * 10}
                className={cn("h-1.5 w-14", classes.bar)}
              />
              <span className={cn("text-[13px] font-semibold tabular-nums", classes.text)}>
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
          <span className="text-[13px] text-slate-700">
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

  if (articles.length === 0) {
    return (
      <EmptyState
        icon={<FileText size={20} />}
        title={viewAll ? "No articles yet" : `No articles for ${dayjs(month).format("MMMM YYYY")}`}
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
        viewAll ? "No articles found." : `No articles for ${dayjs(month).format("MMMM YYYY")}.`
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
