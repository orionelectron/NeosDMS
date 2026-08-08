import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

export interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

type PageItem = number | "ellipsis-start" | "ellipsis-end";

function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: PageItem[] = [1];
  if (page > 3) items.push("ellipsis-start");
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let current = start; current <= end; current += 1) items.push(current);
  if (page < totalPages - 2) items.push("ellipsis-end");
  items.push(totalPages);
  return items;
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: TablePaginationProps) {
  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const items = getPageItems(safePage, totalPages);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 sm:flex-row",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing{" "}
        <span className="font-medium text-foreground">
          {start}–{end}
        </span>{" "}
        of{" "}
        <span className="font-medium text-foreground">{total}</span> results
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent className="flex-wrap justify-center sm:justify-end">
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              disabled={safePage <= 1}
              onClick={() => onPageChange(1)}
              aria-label="Go to first page"
              title="First page"
            >
              <ChevronsLeft className="size-4" aria-hidden />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              disabled={safePage <= 1}
              onClick={() => onPageChange(safePage - 1)}
              aria-label="Go to previous page"
              title="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
          </PaginationItem>
          {items.map((item, index) =>
            typeof item === "number" ? (
              <PaginationItem key={item}>
                <Button
                  variant={item === safePage ? "outline" : "ghost"}
                  size="icon"
                  aria-current={item === safePage ? "page" : undefined}
                  onClick={() => onPageChange(item)}
                  className="size-9 font-medium"
                >
                  {item}
                </Button>
              </PaginationItem>
            ) : (
              <PaginationItem key={`${item}-${index}`}>
                <PaginationEllipsis className="size-9" />
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              disabled={safePage >= totalPages}
              onClick={() => onPageChange(safePage + 1)}
              aria-label="Go to next page"
              title="Next page"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="ghost"
              size="icon"
              disabled={safePage >= totalPages}
              onClick={() => onPageChange(totalPages)}
              aria-label="Go to last page"
              title="Last page"
            >
              <ChevronsRight className="size-4" aria-hidden />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
