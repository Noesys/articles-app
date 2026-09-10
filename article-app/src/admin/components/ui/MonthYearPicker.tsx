import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

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

function currentYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface MonthYearPickerProps {
  label?: string;
  value: string; // 'YYYY-MM'
  onChange: (value: string) => void;
  minValue?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

/** Shared month/year popover used on filter toolbars. */
export function MonthYearPicker({
  label,
  value,
  onChange,
  minValue,
  disabled,
  className,
  triggerClassName,
}: MonthYearPickerProps) {
  const [year, month] = value.split("-").map(Number);
  const [viewYear, setViewYear] = useState(year);
  const [open, setOpen] = useState(false);
  const now = currentYm();

  useEffect(() => {
    if (!Number.isNaN(year)) setViewYear(year);
  }, [year]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={label ? `${label}: ${MONTHS_FULL[month - 1]} ${year}` : undefined}
          className={cn(
            "h-9 w-[180px] justify-between border-border bg-white text-sm font-normal shadow-none rounded-sm",
            triggerClassName,
            className,
          )}
        >
          {MONTHS_FULL[month - 1]} {year}
          <Calendar className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] rounded-sm p-3" align="start">
        {label ? <div className="mb-2 text-xs text-muted-foreground">{label}</div> : null}
        <div className="mb-2 flex items-center justify-between">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Previous year"
            onClick={() => setViewYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-slate-800">{viewYear}</span>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Next year"
            onClick={() => setViewYear((y) => y + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {MONTHS_SHORT.map((m, i) => {
            const monthValue = `${viewYear}-${String(i + 1).padStart(2, "0")}`;
            const isDisabled = minValue ? monthValue < minValue : false;
            const isSelected = viewYear === year && i === month - 1;
            const isCurrent = monthValue === now;

            return (
              <Button
                key={m}
                type="button"
                size="sm"
                disabled={isDisabled}
                variant={isSelected ? "default" : "ghost"}
                aria-current={isCurrent ? "date" : undefined}
                className={cn("relative h-9 text-sm", !isSelected && "hover:bg-accent")}
                onClick={() => {
                  onChange(monthValue);
                  setOpen(false);
                }}
              >
                {m}
                {isCurrent && (
                  <span
                    className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary"
                    aria-hidden
                  />
                )}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
