import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  /** Hide this column in the mobile card view (e.g. redundant/internal ids). */
  hideOnCard?: boolean;
  sortable?: boolean;
}

/**
 * Renders a real <table> at sm+ and switches to a stacked card list below
 * 640px — both are rendered and toggled with Tailwind responsive display
 * classes, so there's no client-side viewport branching or hydration
 * mismatch. docs/IMPLEMENTATION_PLAN.md Bölüm B.2.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyState,
  sortKey,
  sortDirection,
  onSort,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex min-h-32 items-center justify-center px-4 py-12 text-center text-sm text-fg-subtle">
        {emptyState}
      </div>
    );
  }

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="bg-info text-fg-on-brand">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn("whitespace-nowrap px-3 py-2 text-left font-semibold", col.className)}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort?.(col.key)}
                      className="inline-flex items-center gap-1"
                    >
                      {col.header}
                      <SortIcon active={sortKey === col.key} direction={sortDirection} />
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  "border-b border-border",
                  onRowClick && "cursor-pointer hover:bg-bg-muted",
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("whitespace-nowrap px-3 py-2", col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <ul className="flex flex-col gap-2 p-3 sm:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            onClick={() => onRowClick?.(row)}
            className={cn(
              "rounded-lg border border-border bg-bg-subtle p-3",
              onRowClick && "cursor-pointer active:bg-bg-muted",
            )}
          >
            {columns
              .filter((c) => !c.hideOnCard)
              .map((col) => (
                <div key={col.key} className="flex items-baseline justify-between gap-3 py-0.5">
                  <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-fg-subtle">
                    {col.header}
                  </span>
                  <span className="truncate text-right text-sm text-fg">{col.render(row)}</span>
                </div>
              ))}
          </li>
        ))}
      </ul>
    </>
  );
}

function SortIcon({ active, direction }: { active: boolean; direction?: "asc" | "desc" }) {
  return (
    <span aria-hidden="true" className={cn("text-[10px] leading-none", !active && "opacity-40")}>
      {active && direction === "desc" ? "↓" : "↑"}
    </span>
  );
}
