import { ArticleStatus, ArticleSummary } from "@/admin/utils/types";
import { ClockCircleOutlined } from "@ant-design/icons";
import { ColumnsType, TableProps } from "antd/es/table";
import { Search } from "lucide-react";
import {
  Table,
  Tag,
  Avatar,
  Progress,
  Typography,
  Space,
  Empty,
  Card,
  Row,
  Col,
  Tooltip,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { formatDateToUSLocale } from "@/admin/utils/date";

type ArticlesTableProps = {
  articles: ArticleSummary[];
  onRowClick?: (id: string) => void;
};

const { Text } = Typography;

function getAiScoreColor(status: ArticleStatus) {
  if (status === "approved") return "#389e0d";
  if (status === "rewrite_required" || status === "failed") return "#cf1322";
  return "#d48806";
}

const STATUS_CONFIG: Record<
  ArticleStatus,
  { color: string; label: string; icon?: boolean }
> = {
  approved: {
    color: "green",
    label: "Accepted",
  },
  rewrite_required: {
    color: "red",
    label: "Rejected",
  },
  pending: {
    color: "gold",
    label: "Pending",
    icon: true,
  },
  failed: {
    color: "orange",
    label: "Failed",
  },
  unknown: {
    color: "default",
    label: "Unavailable",
  },
};

function getNameInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function ArticlesTableContent({
  articles,
  onRowClick,
}: ArticlesTableProps) {
  const [columns, setColumns] = useState<ColumnsType<ArticleSummary>>([]);

  const [titleFilter, setTitleFilter] = useState("");

  const [visibleRows, setVisibleRows] = useState<ArticleSummary[]>(articles);

  useEffect(() => {
    setVisibleRows(articles);
  }, [articles]);

  const locallyFilteredArticles = useMemo(() => {
    const normalizedTitle = titleFilter.trim().toLowerCase();
    if (!normalizedTitle) return articles;
    return articles.filter((article) =>
      article.title.toLowerCase().includes(normalizedTitle),
    );
  }, [articles, titleFilter]);

  useEffect(() => {
    setVisibleRows(locallyFilteredArticles);
  }, [locallyFilteredArticles]);

  const dashboard = useMemo(() => {
    const total = visibleRows.length;

    const approved = visibleRows.filter(
      (article) => article.status === "approved",
    ).length;

    const pending = visibleRows.filter(
      (article) => article.status === "pending",
    ).length;

    const rewriteRequired = visibleRows.filter(
      (article) => article.status === "rewrite_required",
    ).length;

    const scored = visibleRows.filter((article) => article.ai_score !== null);

    const averageScore =
      scored.length > 0
        ? scored.reduce((sum, article) => sum + (article.ai_score ?? 0), 0) /
          scored.length
        : null;

    return {
      total,
      approved,
      pending,
      rewriteRequired,
      averageScore,
    };
  }, [visibleRows]);

  useEffect(() => {
    const fs = 13;
    const initialColumns: ColumnsType<ArticleSummary> = [
      {
        title: "Title",
        dataIndex: "title",
        key: "title",
        ellipsis: { showTitle: false },
        width: 340,
        render: (title: string) => (
          <Tooltip title={title}>
            <Text
              ellipsis
              className="font-medium"
              style={{
                color: "var(--ant-color-link, #2f54eb)",
                fontSize: fs,
              }}
            >
              {title}
            </Text>
          </Tooltip>
        ),
      },
      {
        title: "Author",
        dataIndex: "author_name",
        key: "author_name",
        width: 160,
        ellipsis: true,
        render: (name: string) => (
          <Space size={8}>
            <Avatar
              size={26}
              style={{ backgroundColor: "#7f77dd", fontSize: 11 }}
            >
              {getNameInitials(name)}
            </Avatar>
            <Text ellipsis style={{ fontSize: fs }}>
              {name}
            </Text>
          </Space>
        ),
      },
      {
        title: "Type",
        dataIndex: "article_type_name",
        key: "type",
        width: 130,
        render: (type: string) => (
          <Tag bordered={false} style={{ fontSize: fs }}>
            {type}
          </Tag>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 115,
        render: (status: ArticleStatus) => {
          const cfg = STATUS_CONFIG[status];
          return (
            <Tag
              color={cfg.color}
              icon={cfg.icon ? <ClockCircleOutlined /> : undefined}
              style={{ fontSize: fs }}
            >
              {cfg.label}
            </Tag>
          );
        },
      },
      {
        title: "Version",
        dataIndex: "version",
        key: "version",
        width: 85,
        render: (version: number) => (
          <Text className="text-sm">v{version}</Text>
        ),
      },

      {
        title: "AI Score",
        dataIndex: "ai_score",
        key: "ai_score",
        width: 130,
        render: (score: number | null, record: ArticleSummary) =>
          score === null ? (
            <Text style={{ fontSize: fs }}>—</Text>
          ) : (
            <Space size={8} align="center">
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
            </Space>
          ),
      },
      {
        title: "Created",
        dataIndex: "submitted_at",
        key: "created_at",
        width: 125,
        render: (date: string) => (
          <Text style={{ fontSize: fs }}>{formatDateToUSLocale(date)}</Text>
        ),
        defaultSortOrder: "descend",
      },
    ];
    setColumns(initialColumns);
  }, []);

  return (
    <div className="space-y-4">
      {/* Dashboard - full width, reduced height */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card size="small" styles={{ body: { padding: "10px 14px" } }}>
            <Text type="secondary" className="text-xs">
              Total Articles
            </Text>
            <div className="text-xl font-semibold mt-0.5">
              {dashboard.total}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card size="small" styles={{ body: { padding: "10px 14px" } }}>
            <Text type="secondary" className="text-xs">
              Accepted
            </Text>
            <div className="text-xl font-semibold text-emerald-600 mt-0.5">
              {dashboard.approved}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card size="small" styles={{ body: { padding: "10px 14px" } }}>
            <Text type="secondary" className="text-xs">
              Pending
            </Text>
            <div className="text-xl font-semibold text-amber-600 mt-0.5">
              {dashboard.pending}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card size="small" styles={{ body: { padding: "10px 14px" } }}>
            <Text type="secondary" className="text-xs">
              Rejected
            </Text>
            <div className="text-xl font-semibold text-red-600 mt-0.5">
              {dashboard.rewriteRequired}
            </div>
          </Card>
        </Col>
      </Row>

      <div>
        <div className="flex items-center gap-2 mb-4 w-full">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
              placeholder="Search title..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent h-9"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
      >
        <div
          className="flex items-center justify-between px-5 py-4"
        ></div>

        <Table<ArticleSummary>
          components={{}}
          columns={columns}
          dataSource={locallyFilteredArticles}
          rowKey="id"
          pagination={{
            pageSize: 10,
            hideOnSinglePage: true,
          }}
          scroll={{ x: 1085 }}
          onRow={(record) => ({
            onClick: () => onRowClick?.(record.id),
            className: onRowClick ? "cursor-pointer" : "cursor-default",
          })}
          locale={{
            emptyText: <Empty description="No articles found" />,
          }}
        />
      </div>
    </div>
  );
}
