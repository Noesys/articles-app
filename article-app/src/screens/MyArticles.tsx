import Header from "../components/Header";
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Loader2,
} from "lucide-react";
import dayjs from "dayjs";
import { useMyArticles } from "../hooks/useMyArticles";
import { useAuth } from "../contexts/AuthContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { api } from "@/http-client";
import {
  ConfigProvider,
  Table,
  Tag,
  Progress,
  Typography,
  Empty,
  Select as AntSelect,
  Tooltip,
  theme as antdTheme,
} from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { Resizable } from "react-resizable";
import "react-resizable/css/styles.css";
import { ArticleListItem } from "@/utils/types";

const { Text } = Typography;

type ArticleStatus = "accepted" | "rejected" | "scoring";

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  accepted: { color: "green", label: "Accepted" },
  rejected: { color: "red", label: "Rejected" },
  scoring: { color: "default", label: "Scoring..." },
};

function getDisplayStatus(article: {
  status: string;
  ai_score: number | null;
}): { key: ArticleStatus; label: string; color: string } {
  if (article.status === "failed") {
    return {
      key: "rejected",
      label: "Failed",
      color: "orange",
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
      color: STATUS_CONFIG.scoring.color,
    };
  }

  if (article.status === "approved") {
    return {
      key: "accepted",
      label: STATUS_CONFIG.accepted.label,
      color: STATUS_CONFIG.accepted.color,
    };
  }

  return {
    key: "rejected",
    label: STATUS_CONFIG.rejected.label,
    color: STATUS_CONFIG.rejected.color,
  };
}

function getAiScoreColor(status: string) {
  if (status === "approved") return "#389e0d";
  if (status === "rewrite_required" || status === "failed") return "#cf1322";
  return "#d48806";
}

const ResizeableTitle = ({ onResize, width, children, ...restProps }: { onResize?: (e: React.SyntheticEvent, data: { size: { width: number; height: number } }) => void; width?: number; children?: React.ReactNode } & React.HTMLAttributes<HTMLTableHeaderCellElement>) => {
  if (!width || typeof width !== "number")
    return <th {...restProps}>{children}</th>;
  return (
    <Resizable
      width={width}
      height={10}
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
      handle={
        <span
          className="column-resize-handle"
          onClick={(e) => e.stopPropagation()}
        />
      }
    >
      <th {...restProps}>{children}</th>
    </Resizable>
  );
};

export default function MyArticles() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout, user } = useAuth();

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
  const [articleTypes, setArticleTypes] = useState<
    { id: string; name: string }[]
  >([]);
  const [typesError, setTypesError] = useState<string | null>(null);

  useEffect(() => {
    api<{ id: string; name: string }[]>("/article-types")
      .then(setArticleTypes)
      .catch((err) =>
        setTypesError(err instanceof Error ? err.message : "Failed to load types"),
      );
  }, []);

  const { articles, loading, error, pagination, isPolling, refetch } =
    useMyArticles({
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
          a.type === typeFilter ||
          articleTypes.find((t) => t.id === typeFilter)?.name === a.type,
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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">
              My Articles
            </h1>
          </div>
          <button
            onClick={() => navigate("/articles/new")}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            <Plus size={16} />
            New Article
          </button>
        </div>

        {/* Filters */}
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
                  const m = dayjs()
                    .year(focusedYear)
                    .month(i)
                    .format("YYYY-MM");
                  const isSelected = month === m;
                  const isCurrent = dayjs().format("YYYY-MM") === m;
                  return (
                    <Button
                      key={i}
                      variant={isSelected ? "default" : "ghost"}
                    onClick={() => setFilterParam("month", m, currentMonth)}
                      className={`h-9 text-sm ${isSelected ? "" : "hover:bg-accent hover:text-accent-foreground"}`}
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

          <AntSelect
            value={typeFilter}
            onChange={(value) => setFilterParam("type", value, "all")}
            showSearch
            optionFilterProp="label"
            placeholder="Filter by Type"
            style={{ width: 180, height: 36 }}
            className="[&_.ant-select-selector]:!bg-white [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-slate-300 [&_.ant-select-selector]:!h-9"
            styles={{
              popup: {
                root: { background: "#fff" },
              },
            }}
            options={[
              { value: "all", label: "All Types" },
              ...articleTypes.map((t) => ({ value: t.id, label: t.name })),
            ]}
            filterOption={(input, option) =>
              (option?.label as string)
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          />
          <AntSelect
            value={statusFilter}
            onChange={(value) => setFilterParam("status", value, "all")}
            showSearch
            optionFilterProp="label"
            placeholder="Filter by Status"
            style={{ width: 180, height: 36 }}
            className="[&_.ant-select-selector]:!bg-white [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-slate-300 [&_.ant-select-selector]:!h-9"
            styles={{
              popup: {
                root: { background: "#fff" },
              },
            }}
            options={[
              { value: "all", label: "All Status" },
              { value: "accepted", label: "Accepted" },
              { value: "rejected", label: "Rejected" },
            ]}
            filterOption={(input, option) =>
              (option?.label as string)
                .toLowerCase()
                .includes(input.toLowerCase())
            }
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
            <Loader2 size={12} className="animate-spin" /> Processing your
            submission — auto-refreshing...
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Table — same antd Table as admin ArticlesTable */}
        <MyArticlesTable
          articles={filteredArticles}
          loading={loading}
          onRowClick={(id) => navigate(`/articles/${id}`)}
          month={month}
          viewAll={viewAll}
        />

        {/* Pagination */}
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
  const [columns, setColumns] = useState<ColumnsType<ArticleListItem>>([]);

  useEffect(() => {
    const fs = 13;
    const cols: ColumnsType<ArticleListItem> = [
      {
        title: "Title",
        dataIndex: "title",
        key: "title",
        ellipsis: { showTitle: false },
        width: 340,
        render: (v: string) => (
          <Tooltip title={v}>
            <Text
              ellipsis
              style={{ color: "#1e293b", fontWeight: 600, fontSize: fs }}
            >
              {v}
            </Text>
          </Tooltip>
        ),
      },
      {
        title: "Type",
        dataIndex: "type",
        key: "type",
        width: 130,
        render: (v: string) => (
          <Tag bordered={false} style={{ color: "#334155", fontSize: fs }}>
            {v}
          </Tag>
        ),
      },
      {
        title: "Version",
        dataIndex: "version",
        key: "version",
        width: 85,
        render: (v: number) => (
          <Text className="text-slate-700" style={{ fontSize: fs }}>
            v{v}
          </Text>
        ),
      },
      {
        title: "AI Score",
        dataIndex: "ai_score",
        key: "ai_score",
        width: 130,
        render: (score: number | null, record: ArticleListItem) =>
          score === null ? (
            <Text style={{ color: "#334155", fontSize: fs }}>—</Text>
          ) : (
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <Progress
                percent={Math.min(Math.max(score, 0), 10) * 10}
                size="small"
                showInfo={false}
                strokeColor={getAiScoreColor(record.status)}
                style={{ width: 56 }}
              />
              <Text
                strong
                style={{ color: getAiScoreColor(record.status), fontSize: fs }}
              >
                {score}
              </Text>
            </span>
          ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 115,
        render: (_: string, record: ArticleListItem) => {
          const cfg = getDisplayStatus(record);
          return (
            <Tag color={cfg.color} style={{ fontSize: fs }}>
              {cfg.label}
            </Tag>
          );
        },
      },
      {
        title: "Created",
        dataIndex: "created",
        key: "created",
        width: 125,
        render: (d: string) => (
          <Text style={{ color: "#334155", fontSize: fs }}>
            {dayjs(d).format("MMM D, YYYY")}
          </Text>
        ),
        defaultSortOrder: "descend" as const,
      },
    ];
    setColumns(cols);
  }, []);

  const handleResize =
    (index: number) =>
    (_: unknown, { size }: { size: { width: number } }) => {
      setColumns((cur) => {
        const next = [...cur];
        next[index] = { ...next[index], width: size.width };
        return next;
      });
    };
  const mergedColumns = columns.map((col, idx) => ({
    ...col,
    ...(typeof col.width === "number"
      ? {
          onHeaderCell: () => ({
            width: col.width,
            onResize: handleResize(idx),
          }),
        }
      : {}),
  }));

  return (
    <ConfigProvider
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: { colorPrimary: "#534ab7", borderRadius: 8 },
        components: {
          Table: {
            headerBg: "#e2e8f0",
            headerColor: "#1e293b",
            headerSplitColor: "#cbd5e1",
          },
        },
      }}
    >
      <div
        style={{
          background: "var(--ant-color-bg-container)",
          border: "1px solid var(--ant-color-border-secondary)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <Table<ArticleListItem>
          components={{ header: { cell: ResizeableTitle } }}
          columns={mergedColumns}
          dataSource={articles}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          scroll={{ x: 925 }}
          onRow={(record) => ({
            onClick: () => onRowClick(record.id),
            style: { cursor: "pointer", background: "#ffffff" },
          })}
          locale={{
            emptyText: (
              <Empty
                description={
                  viewAll
                    ? "No articles found."
                    : `No articles for ${dayjs(month).format("MMMM-YYYY")}.`
                }
              />
            ),
          }}
        />
      </div>
    </ConfigProvider>
  );
}
