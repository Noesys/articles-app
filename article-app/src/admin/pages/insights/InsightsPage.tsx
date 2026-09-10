import { EmployeeSubmissionsTable } from "@/admin/components/insights/EmployeeSubmissionsTable";
import { SummaryView } from "@/admin/components/insights/SummaryView";
import { MonthYearPicker } from "@/admin/components/ui/MonthYearPicker";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageHeader, PageShell, FilterToolbar } from "@/components/page-chrome";
import { useState } from "react";

const currentMonthYear = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const InsightsPage = () => {
  const [insights, setInsights] = useState("Employee Submissions");
  const [start, setStart] = useState(currentMonthYear());
  const [end, setEnd] = useState(currentMonthYear());

  return (
    <PageShell>
      <PageHeader title="Insights" subtitle="Submission and parameter summaries" />
      <FilterToolbar>
        <FilterSelect
          value={insights}
          onValueChange={setInsights}
          triggerClassName="w-[200px]"
          aria-label="Insight view"
          options={[
            { value: "Employee Submissions", label: "Employee submissions" },
            { value: "Summary", label: "Summary" },
          ]}
        />
        <span className="text-sm font-medium text-slate-700">Start</span>
        <MonthYearPicker label="Start" value={start} onChange={setStart} />
        <span className="text-sm font-medium text-slate-700">End</span>
        <MonthYearPicker label="End" value={end} onChange={setEnd} minValue={start} />
      </FilterToolbar>
      <div>
        {insights === "Summary" ? (
          <SummaryView start={start} end={end} />
        ) : (
          <EmployeeSubmissionsTable start={start} end={end} />
        )}
      </div>
    </PageShell>
  );
};

export default InsightsPage;
