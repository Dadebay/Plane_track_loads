import { defineRouting } from "next-intl/routing";

export const LOCALES = ["tk", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "tk",
  localePrefix: "always",
});
