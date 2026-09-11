// components/MonthYearPicker.tsx
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const MONTHS_SHORT = [
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
const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface MonthYearPickerProps {
  label?: string;
  value: string; // 'YYYY-MM'
  onChange: (value: string) => void;
  minValue?: string;
}

export function MonthYearPicker({ label, value, onChange, minValue }: MonthYearPickerProps) {
  const [year, month] = value.split("-").map(Number);
  const [viewYear, setViewYear] = useState(year);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[180px] h-9 bg-white border border-slate-300 rounded-lg text-sm shadow-none justify-between font-normal"
        >
          {MONTHS_FULL[month - 1]} {year}
          <Calendar className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" sideOffset={4} className="w-64 p-3 rounded-lg">
        {label && <div className="mb-2 text-xs text-muted-foreground">{label}</div>}
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" className="h-7 w-7 p-0 opacity-50 hover:opacity-100" onClick={() => setViewYear((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-bold text-sm">{viewYear}</span>
          <Button variant="ghost" className="h-7 w-7 p-0 opacity-50 hover:opacity-100" onClick={() => setViewYear((y) => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {MONTHS_SHORT.map((m, i) => {
            const monthValue = `${viewYear}-${String(i + 1).padStart(2, "0")}`;
            const isDisabled = minValue ? monthValue < minValue : false;

            return (
              <Button
                key={m}
                disabled={isDisabled}
                variant="ghost"
                className={`h-9 text-sm rounded-lg !ring-0 !outline-none focus-visible:!ring-0 focus:!ring-0 ${
                  viewYear === year && i === month - 1
                    ? "!bg-indigo-600 !text-white hover:!bg-indigo-700 hover:!text-white shadow-none focus-visible:!bg-indigo-600"
                    : "hover:bg-accent hover:text-accent-foreground"
                }`}
                onClick={() => onChange(monthValue)}
              >
                {m}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
