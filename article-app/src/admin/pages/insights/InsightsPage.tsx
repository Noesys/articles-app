import { EmployeeSubmissionsTable } from "@/admin/components/insights/EmployeeSubmissionsTable";
import { SummaryView } from "@/admin/components/insights/SummaryView";
import { MonthYearPicker } from "@/admin/components/ui/MonthYearPicker";
import { Select } from "antd";
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
    <div className="w-full px-4 md:px-8 py-5">
      <h1 className="text-3xl font-semibold mb-5">Insights</h1>
      <div className="flex items-center gap-3 mb-5">
        <Select
          className="w-[200px] h-9 [&_.ant-select-selector]:!bg-white [&_.ant-select-selector]:!rounded-lg [&_.ant-select-selector]:!border-slate-300 [&_.ant-select-selector]:!h-9 text-sm"
          styles={{
            popup: {
              root: { background: "#fff" },
            },
          }}  
          showSearch
          optionFilterProp="label"
          filterOption={(input, opt) =>
            (opt?.label as string).toLowerCase().includes(input.toLowerCase())
          }
          value={insights}
          onChange={setInsights}
          options={[
            { value: "Employee Submissions", label: "Employee Submissions" },
            { value: "Summary", label: "Summary" },
          ]}
        />
        <span className="font-bold text-sm">Start Date</span>
        <MonthYearPicker label="Start" value={start} onChange={setStart} />
        <span className="font-bold text-sm">End Date</span>
        <MonthYearPicker
          label="End"
          value={end}
          onChange={setEnd}
          minValue={start}
        />
      </div>
      <div>
        {insights === "Summary" ? (
          <SummaryView start={start} end={end} />
        ) : (
          <EmployeeSubmissionsTable start={start} end={end} />
        )}
      </div>
    </div>
  );
};

export default InsightsPage;
