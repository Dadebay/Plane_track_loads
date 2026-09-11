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
  inline = false,
}: {
  label: string;
  children: ReactNode;
  /**
   * Put the label to the left of the control instead of above it, as a
   * short `FROM:` / `VIA:` / `TO:` prefix. Used where several one-line
   * fields belong to one idea (a route) and stacked labels would make the
   * group three times taller than it needs to be.
   */
  inline?: boolean;
}) {
  if (inline) {
    return (
      <label className="flex items-center gap-2 text-xs font-medium text-fg-muted">
        {/* Fixed width so the controls line up down the column. The colon is
            added here rather than in the translations, so the same strings
            keep working where the label sits above the field. */}
        <span className="w-11 shrink-0 uppercase tracking-wide">{label}:</span>
        <span className="min-w-0 flex-1">{children}</span>
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-fg-muted">
      <span className="uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
