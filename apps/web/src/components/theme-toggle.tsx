"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@tua/ui";

const OPTIONS = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
  { value: "system", Icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("theme");
  // next-themes resolves the actual theme only after mount; render a
  // stable placeholder until then to avoid hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      className="inline-flex h-9 items-center gap-0.5 rounded-full border border-border bg-bg-subtle p-1"
    >
      {OPTIONS.map(({ value, Icon }) => {
        const active = mounted && (theme ?? "system") === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(value)}
            title={t(value)}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
              "min-h-11 min-w-11 sm:min-h-7 sm:min-w-7",
              active
                ? "bg-brand-500 text-fg-on-brand shadow-sm"
                : "text-fg-muted hover:bg-bg-muted hover:text-fg",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
