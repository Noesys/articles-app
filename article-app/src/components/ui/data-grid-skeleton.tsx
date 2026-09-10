import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  contiqTableContainerClassName,
} from "@/admin/utils/contiq-data-grid";

/** Table-shaped skeleton that matches Contiq DataGrid chrome (no layout jump). */
export function DataGridSkeleton({
  rows = 8,
  cols = 5,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(contiqTableContainerClassName, className)}
      role="status"
      aria-label="Loading"
    >
      <div className="border-b border-border bg-slate-50 px-3 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1 rounded-sm" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-3 py-3">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn("h-4 flex-1 rounded-sm", c === 0 && "max-w-[40%]")}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
