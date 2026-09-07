import { useEffect, useState } from "react";
import { Table, Spin, ConfigProvider, theme as antdTheme } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  EmployeeSubmissionRow,
  EmployeeSubmissionsResult,
} from "@/admin/utils/types";
import { tokenManager } from "@/http-client";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const formatMonth = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MONTH_LABELS[Number(m) - 1]}-${y.slice(2)}`;
};

const BACKEND_URL = ((import.meta.env.VITE_BACKEND_URL as string | undefined) || "").replace(/\/$/, "");

export function EmployeeSubmissionsTable({
  start,
  end,
}: {
  start: string;
  end: string;
}) {
  const [data, setData] = useState<EmployeeSubmissionsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEmployeeSubmissions() {
      setLoading(true);
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/insights/employee-submissions?start=${start}&end=${end}`,
          {
            headers: {
              Authorization: `Bearer ${tokenManager.get()}`,
            },
          },
        );
        const data = await res.json();
        setData(data);
      } finally {
        setLoading(false);
      }
    }

    loadEmployeeSubmissions();
  }, [start, end]);

  if (loading) return <Spin className="mt-10 flex justify-center" />;
  if (!data) return null;

  const columns: ColumnsType<EmployeeSubmissionRow> = [
    { title: "Name", dataIndex: "name", fixed: "left", width: 180 },
    { title: "Department", dataIndex: "jobRole", width: 120 },
    ...data.months.map((m) => ({
      title: formatMonth(m),
      dataIndex: ["monthly", m],
      width: 80,
      align: "center" as const,
      render: (val: number) => val || "-",
    })),
    {
      title: "Total",
      dataIndex: "total",
      fixed: "right",
      width: 80,
      align: "center" as const,
    },
  ];

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
        <style>{`.employee-summary-row td{ background:#e2e8f0 !important; }`}</style>
        <Table
          rowKey="userId"
          columns={columns}
          dataSource={data.rows}
          pagination={false}
          scroll={{ x: "max-content" }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row className="employee-summary-row">
                <Table.Summary.Cell index={0} colSpan={2}>
                  <span className="text-slate-700">Total: </span>
                  <span className="font-bold text-slate-700">
                    {data.rows.length}
                  </span>
                </Table.Summary.Cell>
                {data.months.map((m, i) => (
                  <Table.Summary.Cell key={m} index={i + 2} align="center">
                    <span className="font-bold text-slate-700">
                      {data.monthlyTotals[m]}
                    </span>
                  </Table.Summary.Cell>
                ))}
                <Table.Summary.Cell
                  index={data.months.length + 2}
                  align="center"
                >
                  <span className="font-bold text-slate-700">
                    {data.grandTotal}
                  </span>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </div>
    </ConfigProvider>
  );
}
