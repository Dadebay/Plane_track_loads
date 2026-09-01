import type { ReactNode } from "react";

/**
 * Responsive filter bar: fields wrap on tablet, stack on mobile. Fields are
 * passed as children so this component stays agnostic of what's filtered.
 */
export function FilterPanel({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-subtle p-3 sm:flex-row sm:flex-wrap sm:items-end sm:p-4">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  );
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
      <span className="uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
