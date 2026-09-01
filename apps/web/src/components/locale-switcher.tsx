"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, type Locale } from "@/i18n/routing";
import { cn } from "@tua/ui";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onSelect(next: Locale) {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div
      className={cn(
        "relative inline-flex h-9 min-h-11 items-center gap-1.5 rounded-full border border-border bg-bg-subtle pl-3 pr-2.5 sm:min-h-9",
        "transition-colors has-[select:hover]:bg-bg-muted has-[select:focus-visible]:ring-2 has-[select:focus-visible]:ring-ring",
        isPending && "opacity-60",
      )}
    >
      <Languages className="h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
      <select
        aria-label={t("label")}
        value={locale}
        disabled={isPending}
        onChange={(e) => onSelect(e.target.value as Locale)}
        className="cursor-pointer appearance-none bg-transparent pr-4 text-sm font-medium text-fg outline-none disabled:cursor-wait"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} className="bg-bg text-fg">
            {t(l)}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 shrink-0 text-fg-subtle"
        aria-hidden="true"
      />
    </div>
  );
}
