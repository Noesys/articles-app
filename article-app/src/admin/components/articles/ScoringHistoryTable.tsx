import { HistoryItem } from "@/utils/types";
import { ConfigProvider, Table, Tag, Progress, theme as antdTheme } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function getAiScoreColor(status: HistoryItem["status"]) {
  if (status === "approved") return "#389e0d";
  if (status === "rewrite_required" || status === "failed") return "#cf1322";
  return "#d48806";
}

function formatAiScore(s: number) {
  return Number.isInteger(s) ? String(s) : s.toFixed(1);
}

export default function ScoringHistoryTable({
  history,
  articleId,
}: {
  history: HistoryItem[];
  articleId: string;
}) {
  const navigate = useNavigate();
  const [cols, setCols] = useState<ColumnsType<HistoryItem>>([]);
  useEffect(() => {
    const columns: ColumnsType<HistoryItem> = [
      {
        title: "Version",
        dataIndex: "version",
        key: "version",
        width: 90,
        sorter: (a, b) => a.version - b.version,
        render: (v: number, r: HistoryItem) => (
          <span
            onClick={() =>
              navigate(`/admin/articles/${articleId}?version=${r.version}`)
            }
            className="text-sky-600 font-semibold text-sm cursor-pointer"
          >
            Aritcle Version {v}
          </span>
        ),
      },
      {
        title: "AI Score",
        dataIndex: "score",
        key: "score",
        width: 130,
        render: (s: number | null, record: HistoryItem) =>
          s === null ? (
            <span className="text-slate-400 text-[13px]">—</span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Progress
                percent={Math.min(Math.max(s, 0), 10) * 10}
                size="small"
                showInfo={false}
                strokeColor={getAiScoreColor(record.status)}
                className="w-14"
              />

              <span
                style={{ color: getAiScoreColor(record.status) }}
                className="font-semibold text-[13px]"
              >
                {formatAiScore(s)}
              </span>
            </span>
          ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (_: unknown, r: HistoryItem) => {
          const STATUS_MAP: Record<string, { label: string; color: string }> = {
            approved: { label: "Accepted", color: "green" },
            rewrite_required: { label: "Rejected", color: "red" },
            pending: { label: "Scoring...", color: "default" },
            failed: { label: "Rejected", color: "red" },
          };

          const cfg = STATUS_MAP[r.status] || STATUS_MAP.pending;

          return (
            <Tag
              color={cfg.color}
              className="text-[13px]"
            >
              {cfg.label}
            </Tag>
          );
        },
      },
      {
        title: "Submitted",
        dataIndex: "submitted_at",
        key: "submitted_at",
        width: 160,
        sorter: (a, b) => {
          // Compare using snapshotted_at (when available) for accurate timeline archiving order
          const tA = new Date(a.snapshotted_at || a.submitted_at).getTime();
          const tB = new Date(b.snapshotted_at || b.submitted_at).getTime();
          return tA - tB;
        },
        render: (_: string, r: HistoryItem) => {
          // snapshotted_at reflects when this version was archived/replaced when a rewrite was triggered.
          // Using snapshotted_at for historical timeline display ensures each version's row accurately
          // represents when that version ended and entered history, avoiding duplicated timestamps across versions.
          const dateStr = r.snapshotted_at || r.submitted_at;
          if (!dateStr) return <span className="text-slate-400 text-[13px]">—</span>;
          const normalized = typeof dateStr === "string" && dateStr.includes("T") && !dateStr.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(dateStr)
            ? `${dateStr}Z`
            : dateStr;
          return (
            <span className="text-slate-700 text-[13px]">
              {dayjs(normalized).format("MMM D, YYYY h:mm A")}
            </span>
          );
        },
      },
    ];

    setCols(columns);
  }, [articleId]);

  const handleResize =
    (idx: number) =>
    (_: unknown, { size }: { size: { width: number } }) =>
      setCols((cur) => {
        const n = [...cur];
        n[idx] = { ...n[idx], width: size.width };
        return n;
      });

  const merged = cols.map((c, i) => ({
    ...c,
    ...(typeof c.width === "number"
      ? {
          onHeaderCell: () => ({
            width: c.width,
            onResize: handleResize(i),
          }),
        }
      : {}),
  }));

  return (
    <ConfigProvider
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#111827",
          borderRadius: 8,
          colorText: "#111827",
          colorTextSecondary: "#374151",
          fontSize: 14,
          colorBgContainer: "#ffffff",
        },
        components: {
          Table: {
            headerBg: "#ffffff",
            headerColor: "#111827",
            headerSplitColor: "#d1d5db",
            borderColor: "#d1d5db",
            rowHoverBg: "#f9fafb",
            cellPaddingBlock: 14,
          },
        },
      }}
    >
      <div className="bg-white border-[1.5px] border-gray-300 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b-[1.5px] border-gray-300">
          <span className="text-[15px] font-semibold text-gray-900">
            Scoring History
          </span>

          <span className="text-[13px] text-slate-500">
            {history.length} versions
          </span>
        </div>

        <Table<HistoryItem>
          columns={cols}
          dataSource={history}
          rowKey="version"
          pagination={false}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: "No scoring history yet." }}
        />
      </div>
    </ConfigProvider>
  );
}
