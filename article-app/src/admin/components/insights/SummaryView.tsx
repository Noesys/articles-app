import { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DataGridSkeleton } from "@/components/ui/data-grid-skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table";
import { ColumnDef, useTable } from "@tanstack/react-table";
import {
  ArticleTypeSummary,
  NumericDistributionBucket,
  ParameterSummary,
} from "@/admin/utils/types";
import {
  contiqTableContainerClassName,
  contiqTableClassNames,
  contiqTableLayout,
} from "@/admin/utils/contiq-data-grid";
import { api } from "@/http-client";

function NumericDistribution({ distribution }: { distribution: NumericDistributionBucket[] }) {
  if (!distribution?.length) return null;
  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="flex flex-wrap items-end gap-x-1 gap-y-2 mt-1.5 max-w-full">
      <TooltipProvider>
        {distribution.map((bucket) => (
          <Tooltip key={bucket.value}>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent>
              {bucket.value}: {bucket.count}
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
}

function ParametersTable({ parameters }: { parameters: ParameterSummary[] }) {
  const columns = useMemo<ColumnDef<DataGridFeatures, ParameterSummary>[]>(
    () => [
      {
        accessorKey: "parameterName",
        header: "Parameter",
        size: 220,
        cell: ({ getValue }) => (
          <span className="font-medium text-slate-800">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "scopeType",
        header: "Type",
        size: 90,
        cell: ({ getValue }) => (
          <span className="capitalize text-slate-600 text-sm">{getValue() as string}</span>
        ),
      },
      {
        id: "details",
        header: "Details",
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          if (r.scopeType === "option") {
            return (
              <div className="flex flex-wrap gap-1.5">
                {r.options?.map((o) => (
                  <span
                    key={o.label}
                    className={
                      o.count === 0
                        ? "inline-flex items-center rounded-sm bg-slate-50 border border-dashed border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-400"
                        : "inline-flex items-center rounded-sm bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700"
                    }
                  >
                    {o.label}: {o.count}
                  </span>
                ))}
              </div>
            );
          }
          return (
            <div>
              <span className="text-sm text-slate-600">
                avg {r.numeric?.avg.toFixed(1)} · min {r.numeric?.min} · max {r.numeric?.max} · n=
                {r.numeric?.count}
              </span>
              {r.numeric?.distribution && (
                <NumericDistribution distribution={r.numeric.distribution} />
              )}
            </div>
          );
        },
      },
    ],
    [],
  );

  const pageSize = Math.max(parameters.length, 1);
  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: parameters,
    pageCount: 1,
    getRowId: (row) => row.parameterId,
    state: {
      pagination: { pageIndex: 0, pageSize },
    },
  });

  return (
    <DataGrid table={table} recordCount={parameters.length} tableLayout={contiqTableLayout}
        tableClassNames={contiqTableClassNames}>
      <DataGridContainer className={contiqTableContainerClassName}>
        <DataGridScrollArea>
          <DataGridTable />
        </DataGridScrollArea>
      </DataGridContainer>
    </DataGrid>
  );
}

export function SummaryView({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<ArticleTypeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchInsightsSummary(start: string, end: string) {
    const res = await api<ArticleTypeSummary[]>(
      `/admin/insights/summary?start=${start}&end=${end}`,
    );
    return Array.isArray(res) ? res : [];
  }

  useEffect(() => {
    async function loadSummary() {
      setLoading(true);
      try {
        const result = await fetchInsightsSummary(start, end);
        setData(result);
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, [start, end]);

  if (loading) {
    return <DataGridSkeleton rows={6} cols={3} />;
  }

  if (!data?.length) {
    return (
      <Empty className="border border-dashed border-border py-12">
        <EmptyHeader>
          <EmptyTitle>No data</EmptyTitle>
          <EmptyDescription>No data for this range</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Accordion
      type="multiple"
      defaultValue={data.map((d) => d.articleTypeId)}
      className="rounded-sm border border-border bg-background overflow-hidden"
    >
      {data.map((at) => (
        <AccordionItem
          key={at.articleTypeId}
          value={at.articleTypeId}
          className="border-border px-4"
        >
          <AccordionTrigger className="hover:no-underline py-3">
            <span className="font-medium text-slate-900">
              {at.articleTypeName}{" "}
              <span className="font-semibold text-slate-700">({at.totalArticles} articles)</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <ParametersTable parameters={at.parameters ?? []} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
