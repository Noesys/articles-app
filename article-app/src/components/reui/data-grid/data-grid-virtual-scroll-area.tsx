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
/**
 * A `height` for DataGridVirtualScrollArea that shrinks to fit `rowCount`
 * rows (so 1-2 rows don't render inside a viewport-tall box full of empty
 * space) but never grows past `maxHeight` (so a long list still scrolls
 * within a bounded viewport instead of pushing the page height out).
 *
 * `rowHeight`/`headerHeight` should match whatever `estimateSize` and the
 * table's actual header height are for the caller — defaults match this
 * component's own `estimateSize` default and the contiq dense header.
 */
function fitRowsHeight(
  rowCount: number,
  maxHeight: string,
  rowHeight = 45,
  headerHeight = 44,
): string {
  const contentHeight = Math.max(0, rowCount) * rowHeight + headerHeight;
  return `min(${contentHeight}px, ${maxHeight})`;
}

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

export { DataGridVirtualScrollArea, fitRowsHeight };
export type { DataGridVirtualScrollAreaProps };
