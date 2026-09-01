"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { CalendarDays, FileText, Package, Plane, Send, Settings, ShieldCheck } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import { UserMenu } from "./user-menu";
import { cn } from "@tua/ui";

type NavKey =
  | "flightSelection"
  | "flightSchedule"
  | "flightDocument"
  | "uldStock"
  | "messages"
  | "admin"
  | "validation";

const NAV_ITEMS: { key: NavKey; href: string; Icon: typeof Plane }[] = [
  { key: "flightSelection", href: "/flights", Icon: Plane },
  { key: "flightSchedule", href: "/schedule", Icon: CalendarDays },
  { key: "flightDocument", href: "/documents", Icon: FileText },
  { key: "uldStock", href: "/uld", Icon: Package },
  { key: "messages", href: "/messages", Icon: Send },
];

const ADMIN_NAV_ITEMS: { key: NavKey; href: string; Icon: typeof Plane }[] = [
  { key: "admin", href: "/admin/ahm", Icon: Settings },
  { key: "validation", href: "/admin/validation", Icon: ShieldCheck },
];

export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const navItems = isAdmin ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;

  return (
    <div className="flex min-h-dvh flex-col sm:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-bg-subtle sm:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-fg-on-brand">
            <Plane className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="truncate text-sm font-semibold text-fg">{tApp("name")}</span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {navItems.map(({ key, href, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={key}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-500 text-fg-on-brand"
                    : "text-fg-muted hover:bg-bg-muted hover:text-fg",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{t(key)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <UserMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg px-3 sm:h-16 sm:px-6">
          <span className="truncate text-sm font-semibold text-fg sm:hidden">{tApp("name")}</span>
          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </header>

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
