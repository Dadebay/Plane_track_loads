"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { ChevronUp, History, LogOut, User as UserIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@tua/ui";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession();
  const t = useTranslations("account");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const name = session?.user?.name ?? "…";
  const email = session?.user?.email ?? "";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute bottom-full z-20 mb-2 min-w-64 overflow-hidden rounded-xl border border-border bg-bg shadow-xl",
            // In the collapsed rail the trigger is 40px wide, so the menu
            // cannot take its width — it opens alongside it instead.
            compact ? "left-0" : "left-0 w-full",
          )}
        >
          <div className="flex items-center gap-3 border-b border-border p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-fg-on-brand">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">{name}</p>
              <p className="truncate text-xs text-fg-subtle">{email}</p>
            </div>
          </div>
          <nav className="flex flex-col p-1.5">
            <Link
              href="/account"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-fg hover:bg-bg-muted"
            >
              <UserIcon className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
              {t("menu.myAccount")}
            </Link>
            <Link
              href="/account#history"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-fg hover:bg-bg-muted"
            >
              <History className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
              {t("menu.history")}
            </Link>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              role="menuitem"
              onClick={() => signOut()}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-danger hover:bg-danger-bg"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {t("menu.signOut")}
            </button>
          </nav>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        // Collapsed, the name has nowhere to go, so it becomes the button's
        // accessible name and its tooltip instead of being truncated away.
        aria-label={compact ? name : undefined}
        title={compact ? name : undefined}
        className={cn(
          "flex items-center gap-2 rounded-md bg-brand-500 text-sm font-semibold text-fg-on-brand",
          compact ? "h-10 w-10 justify-center" : "w-full px-3 py-2",
        )}
      >
        <UserIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {compact ? null : (
          <>
            <span className="truncate">{name}</span>
            <ChevronUp
              className={cn("ml-auto h-3.5 w-3.5 shrink-0 transition-transform", !open && "rotate-180")}
              aria-hidden="true"
            />
          </>
        )}
      </button>
    </div>
  );
}
