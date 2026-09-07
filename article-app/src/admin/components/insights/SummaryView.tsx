import { useEffect, useState } from "react";
import {
  Collapse,
  Spin,
  Empty,
  ConfigProvider,
  Table,
  theme as antdTheme,
  Tooltip,
} from "antd";
import {
  ArticleTypeSummary,
  NumericDistributionBucket,
  ParameterSummary,
} from "@/admin/utils/types";
import { tokenManager } from "@/http-client";

const BACKEND_URL = ((import.meta.env.VITE_BACKEND_URL as string | undefined) || "").replace(/\/$/, "");

function NumericDistribution({
  distribution,
}: {
  distribution: NumericDistributionBucket[];
}) {
  if (!distribution.length) return null;
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="flex flex-wrap items-end gap-x-1 gap-y-2 mt-1.5 max-w-full">
      {distribution.map((bucket) => (
        <Tooltip key={bucket.value} title={`${bucket.value}: ${bucket.count}`}>
          <div className="flex flex-col items-center justify-end w-4 h-10">
            <div
              className={
                bucket.count === 0
                  ? "w-full rounded-sm bg-slate-100 border border-slate-200"
                  : "w-full rounded-sm bg-[#534ab7]"
              }
              style={{
                height: `${Math.max((bucket.count / maxCount) * 100, bucket.count === 0 ? 6 : 10)}%`,
              }}
            />
            <span className="text-[10px] text-slate-400 mt-0.5 leading-none">
              {bucket.value}
            </span>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}

export function SummaryView({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<ArticleTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchInsightsSummary(start: string, end: string) {
    const res = await fetch(
      `${BACKEND_URL}/api/insights/summary?start=${start}&end=${end}`,
      {
        headers: {
          Authorization: `Bearer ${tokenManager.get()}`,
        },
      },
    );
    const data = await res.json();
    return data;
  }

  useEffect(() => {
    async function loadSummary() {
      setLoading(true);
      try {
        const data = await fetchInsightsSummary(start, end);
        setData(data);
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, [start, end]);

  if (loading)
    return (
      <div className="flex justify-center items-center py-16">
        <Spin />
      </div>
    );
  if (!data.length) return <Empty description="No data for this range" />;

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
          Collapse: { headerBg: "#e2e8f0", contentBg: "#ffffff" },
        },
      }}
    >
      <Collapse
        expandIconPosition="end"
        defaultActiveKey={data.map((d) => d.articleTypeId)}
        items={data.map((at) => ({
          key: at.articleTypeId,
          label: (
            <span className="font-medium text-slate-900">
              {at.articleTypeName}{" "}
              <span className="font-semibold text-slate-700">
                ({at.totalArticles} articles)
              </span>
            </span>
          ),
          children: (
            <Table
              pagination={false}
              size="small"
              dataSource={at.parameters.map((p) => ({
                key: p.parameterId,
                ...p,
              }))}
              columns={[
                {
                  title: "Parameter",
                  dataIndex: "parameterName",
                  key: "parameterName",
                  width: 220,
                  render: (v: string) => (
                    <span className="font-medium text-slate-800">{v}</span>
                  ),
                },
                {
                  title: "Type",
                  dataIndex: "scopeType",
                  key: "scopeType",
                  width: 90,
                  render: (v: string) => (
                    <span className="capitalize text-slate-600 text-sm">
                      {v}
                    </span>
                  ),
                },
                {
                  title: "Details",
                  key: "details",
                  render: (_: unknown, r: ParameterSummary) =>
                    r.scopeType === "option" ? (
                      <div className="flex flex-wrap gap-1.5">
                        {r.options?.map((o) => (
                          <span
                            key={o.label}
                            className={
                              o.count === 0
                                ? "inline-flex items-center rounded-full bg-slate-50 border border-dashed border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-400"
                                : "inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                            }
                          >
                            {o.label}: {o.count}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <span className="text-sm text-slate-600">
                          avg {r.numeric?.avg.toFixed(1)} · min {r.numeric?.min}{" "}
                          · max {r.numeric?.max} · n={r.numeric?.count}
                        </span>
                        {r.numeric?.distribution && (
                          <NumericDistribution
                            distribution={r.numeric.distribution}
                          />
                        )}
                      </div>
                    ),
                },
              ]}
              style={
                {
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  overflow: "hidden",
                } as React.CSSProperties
              }
            />
          ),
        }))}
      />
    </ConfigProvider>
  );
}
