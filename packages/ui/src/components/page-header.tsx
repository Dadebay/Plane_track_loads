import type { ReactNode } from "react";

export function PageHeader({
  title,
  actions,
}: {
  title: ReactNode;
  actions?: ReactNode;
}) {
  return (
    // Sticky because this is now the only top bar on a page — the shell no
    // longer renders one above it, so the page title and the global controls
    // have to stay reachable while the content scrolls.
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg px-4 py-3 sm:px-6">
      <h1 className="text-lg font-semibold text-fg">{title}</h1>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
