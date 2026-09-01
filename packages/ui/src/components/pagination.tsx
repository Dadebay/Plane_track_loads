import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Generic pagination control. No copy is hardcoded here (i18n rule,
 * CLAUDE.md) — the consuming app passes already-translated strings.
 */
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  pageSizeOptions = [5, 10, 25, 50],
  onPageChange,
  onPageSizeChange,
  itemsPerPageLabel,
  totalLabel,
  pageLabel,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemsPerPageLabel: string;
  totalLabel: string;
  pageLabel: (current: number, total: number) => string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-fg-muted sm:px-6">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">
          {itemsPerPageLabel}
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-9 min-h-11 rounded-md border border-border bg-bg-subtle px-2 sm:min-h-9"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <span>
          | {totalLabel}: {total}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="previous page"
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-md border border-border sm:h-9 sm:w-9",
            page <= 1 ? "opacity-40" : "hover:bg-bg-muted",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span>{pageLabel(page, pageCount)}</span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="next page"
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-md border border-border sm:h-9 sm:w-9",
            page >= pageCount ? "opacity-40" : "hover:bg-bg-muted",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
