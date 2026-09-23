"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { CalendarDays, FileText, PanelLeftClose, PanelLeftOpen, Package, Plane, Settings } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { UserMenu } from "./user-menu";
import { cn } from "@tua/ui";

type NavKey = "flightSelection" | "flightSchedule" | "flightDocument" | "uldStock" | "admin";

const NAV_ITEMS: { key: NavKey; href: string; Icon: typeof Plane }[] = [
  { key: "flightSelection", href: "/flights", Icon: Plane },
  { key: "flightSchedule", href: "/schedule", Icon: CalendarDays },
  { key: "flightDocument", href: "/documents", Icon: FileText },
  { key: "uldStock", href: "/uld", Icon: Package },
];

const ADMIN_NAV_ITEMS: { key: NavKey; href: string; Icon: typeof Plane }[] = [
  { key: "admin", href: "/admin/ahm", Icon: Settings },
];

/** Remembers the controller's choice between visits. Read in an effect
 * rather than during render: the server cannot know it, and reading it
 * inline would make the server and client markup disagree. */
const COLLAPSED_KEY = "nav-collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const navItems = isAdmin ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;

  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // Private browsing or blocked storage — the sidebar just starts open.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Not being able to remember the choice must not break making it.
      }
      return next;
    });
  }

  return (
    <div className="flex min-h-dvh flex-col sm:flex-row">
      {/* Desktop sidebar — pinned to the viewport rather than stretched to
          the page. As a plain flex item it took the height of the content
          beside it, so on a long page (a load plan is ~4 000px) the nav
          scrolled off the top and there was no way back to another section
          without scrolling all the way up. `self-start` keeps the flex row
          from stretching it back out. */}
      <aside
        id="app-sidebar"
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-bg-subtle transition-[width] duration-200",
          "sm:sticky sm:top-0 sm:flex sm:h-dvh sm:self-start",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center gap-2 border-b border-border",
            collapsed ? "justify-center px-2" : "px-4",
          )}
        >
          {collapsed ? null : (
            <>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-fg-on-brand">
                <Plane className="h-4 w-4" aria-hidden="true" />
              </div>
              <span className="truncate text-sm font-semibold text-fg">{tApp("name")}</span>
            </>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar"
            aria-label={t(collapsed ? "expandSidebar" : "collapseSidebar")}
            title={t(collapsed ? "expandSidebar" : "collapseSidebar")}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-muted hover:text-fg",
              collapsed ? "" : "ml-auto",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {navItems.map(({ key, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={key}
                href={href}
                // Collapsed there is no room for the label, so it stays as the
                // tooltip and, via sr-only, as the link's accessible name —
                // an icon-only nav must still be navigable by screen reader.
                title={collapsed ? t(key) : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-0" : "px-3",
                  active
                    ? "bg-brand-500 text-fg-on-brand"
                    : "text-fg-muted hover:bg-bg-muted hover:text-fg",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className={cn("truncate", collapsed && "sr-only")}>{t(key)}</span>
              </Link>
            );
          })}
        </nav>

        <div className={cn("border-t border-border", collapsed ? "flex justify-center p-2" : "p-3")}>
          <UserMenu compact={collapsed} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* No header bar here on purpose. The locale and theme controls used
            to sit in a strip of their own directly above every page's title
            bar — two rules across the screen for one row of content. They now
            live at the right end of the page title bar itself; see
            components/page-header.tsx. */}

        {/* Page content — bottom padding on mobile clears the tab bar */}
        <main className="min-w-0 flex-1 pb-16 sm:pb-0">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label={t("flightSelection")}
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-bg sm:hidden"
      >
        {NAV_ITEMS.map(({ key, href, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                "min-h-11",
                active ? "text-brand-500" : "text-fg-subtle",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="truncate px-1">{t(key)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
