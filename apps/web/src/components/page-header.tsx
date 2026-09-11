"use client";

import type { ReactNode } from "react";
import { PageHeader as UiPageHeader } from "@tua/ui";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

/**
 * The single top bar of an authenticated page.
 *
 * The shell used to render its own bar for the locale and theme controls,
 * directly above every page's own title bar — two rules across the screen
 * for one row of content. This merges them: the page title bar is the only
 * bar, and the global controls sit at its right end, after whatever actions
 * the page itself contributes.
 *
 * Wrapping `@tua/ui`'s presentational `PageHeader` rather than changing it:
 * that package must not know about next-intl or next-themes.
 */
export function PageHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <UiPageHeader
      title={title}
      actions={
        <>
          {actions}
          {/* Separates what this page does from what every page does. */}
          {actions ? <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-border" /> : null}
          <LocaleSwitcher />
          <ThemeToggle />
        </>
      }
    />
  );
}
