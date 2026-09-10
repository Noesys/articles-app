import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid";
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import {
  DataGridTable,
  DataGridTableFootRow,
  DataGridTableFootRowCell,
} from "@/components/reui/data-grid/data-grid-table";
import { ColumnDef, useTable } from "@tanstack/react-table";
import { EmployeeSubmissionRow, EmployeeSubmissionsResult } from "@/admin/utils/types";
import {
  contiqTableContainerClassName,
  contiqTableClassNames,
  contiqTableLayout,
} from "@/admin/utils/contiq-data-grid";
import { api } from "@/http-client";

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

export function EmployeeSubmissionsTable({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<EmployeeSubmissionsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEmployeeSubmissions() {
      setLoading(true);
      try {
        const result = await api<EmployeeSubmissionsResult>(
          `/admin/insights/employee-submissions?start=${start}&end=${end}`,
        );
        setData(result);
      } finally {
        setLoading(false);
      }
    }

    loadEmployeeSubmissions();
  }, [start, end]);

  const columns = useMemo<ColumnDef<DataGridFeatures, EmployeeSubmissionRow>[]>(() => {
    if (!data) return [];
    return [
      {
        accessorKey: "name",
        header: "Name",
        size: 180,
        enablePinning: true,
      },
      {
        accessorKey: "jobRole",
        header: "Department",
        size: 120,
      },
      ...data.months.map((m) => ({
        id: `month-${m}`,
        accessorFn: (row: EmployeeSubmissionRow) => row.monthly[m] ?? 0,
        header: formatMonth(m),
        size: 80,
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const val = getValue() as number;
          return <span className="block text-center">{val || "-"}</span>;
        },
      })),
      {
        accessorKey: "total",
        header: "Total",
        size: 80,
        enablePinning: true,
        cell: ({ getValue }) => (
          <span className="block text-center">{getValue() as number}</span>
        ),
      },
    ];
  }, [data]);

  const rows = data?.rows ?? [];
  const pageSize = Math.max(rows.length, 1);

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: rows,
    pageCount: 1,
    getRowId: (row) => row.userId,
    state: {
      pagination: { pageIndex: 0, pageSize },
      columnPinning: { start: ["name"], end: ["total"] },
    },
  });

  if (loading) {
    return (
      <div className="mt-10 flex justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <DataGrid
      table={table}
      recordCount={rows.length}
      tableLayout={{
        ...contiqTableLayout,
        columnsPinnable: true,
        footerBackground: true,
      }}
      tableClassNames={contiqTableClassNames}
    >
      <DataGridContainer className={contiqTableContainerClassName}>
        <DataGridScrollArea>
          <DataGridTable
            footerContent={
              <DataGridTableFootRow>
                <DataGridTableFootRowCell colSpan={2} className="bg-muted">
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-semibold text-foreground">{data.rows.length}</span>
                </DataGridTableFootRowCell>
                {data.months.map((m) => (
                  <DataGridTableFootRowCell key={m} className="bg-muted text-center">
                    <span className="font-semibold text-foreground">{data.monthlyTotals[m]}</span>
                  </DataGridTableFootRowCell>
                ))}
                <DataGridTableFootRowCell className="bg-muted text-center">
                  <span className="font-semibold text-foreground">{data.grandTotal}</span>
                </DataGridTableFootRowCell>
              </DataGridTableFootRow>
            }
          />
        </DataGridScrollArea>
      </DataGridContainer>
    </DataGrid>
  );
}
