import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type SimplePaginationProps = {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
};

export function SimplePagination({ page, total, pageSize, onChange }: SimplePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => {
    if (pageCount <= 7) return true;
    if (p === 1 || p === pageCount) return true;
    return Math.abs(p - page) <= 1;
  });

  const items: Array<number | "ellipsis"> = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]!;
    if (i > 0 && p - pages[i - 1]! > 1) items.push("ellipsis");
    items.push(p);
  }

  return (
    <Pagination className="justify-end w-auto mx-0">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (page > 1) onChange(page - 1);
            }}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
          />
        </PaginationItem>
        {items.map((item, idx) =>
          item === "ellipsis" ? (
            <PaginationItem key={`e-${idx}`}>
              <Button variant="ghost" size="icon" className="pointer-events-none" disabled>
                …
              </Button>
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href="#"
                isActive={item === page}
                onClick={(e) => {
                  e.preventDefault();
                  onChange(item);
                }}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(e) => {
              e.preventDefault();
              if (page < pageCount) onChange(page + 1);
            }}
            aria-disabled={page >= pageCount}
            className={page >= pageCount ? "pointer-events-none opacity-50" : undefined}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
