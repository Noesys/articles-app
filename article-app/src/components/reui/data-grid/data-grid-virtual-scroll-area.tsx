import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area";
import { DataGridTableVirtual } from "@/components/reui/data-grid/data-grid-table-virtual";
import { cn } from "@/lib/utils";

interface DataGridVirtualScrollAreaProps {
  /** Fixed pixel (or CSS length) height of the scrollable viewport — required for virtualization to have a bounded window to measure against. */
  height: number | string;
  onFetchMore?: () => void;
  isFetchingMore?: boolean;
  hasMore?: boolean;
  estimateSize?: number;
  overscan?: number;
  fetchMoreOffset?: number;
  className?: string;
}

/**
 * Drop-in replacement for `<DataGridScrollArea><DataGridTable /></DataGridScrollArea>`
 * that row-virtualizes the body and, given onFetchMore, loads more rows as the
 * user scrolls near the end of what's loaded. Sits inside the same
 * DataGridContainer as before, so contiq-data-grid.ts styling is untouched.
 */
function DataGridVirtualScrollArea({
  height,
  onFetchMore,
  isFetchingMore,
  hasMore,
  estimateSize = 45,
  overscan = 10,
  fetchMoreOffset = 4,
  className,
}: DataGridVirtualScrollAreaProps) {
  return (
    <div className="w-full" style={{ height }}>
      <DataGridScrollArea className={cn("h-full", className)}>
        <DataGridTableVirtual
          estimateSize={estimateSize}
          overscan={overscan}
          onFetchMore={onFetchMore}
          isFetchingMore={isFetchingMore}
          hasMore={hasMore}
          fetchMoreOffset={fetchMoreOffset}
          virtualizerOptions={{
            // estimateSize is only a first-paint guess; without measuring the
            // real DOM row height, the virtualizer's computed total scroll
            // height slowly drifts from the browser's actual scrollHeight.
            // At the very bottom that mismatch makes the browser's scrollTop
            // clamp fight the virtualizer's own re-clamped range each frame —
            // visible as jitter that settles once they converge.
            measureElement: (el) => el.getBoundingClientRect().height,
          }}
        />
      </DataGridScrollArea>
    </div>
  );
}

export { DataGridVirtualScrollArea };
export type { DataGridVirtualScrollAreaProps };
