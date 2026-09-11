import { defineRouting } from "next-intl/routing";

export const LOCALES = ["tk", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const routing = defineRouting({
  locales: LOCALES,
  // English on first open, by operator request (2026-09-10). The message
  // files stay equal in weight — tk and ru are one click away in the
  // switcher and every key exists in all three.
  defaultLocale: "en",
  localePrefix: "always",
  // Off on purpose: with detection on, a browser whose Accept-Language is
  // Turkmen would land on /tk and the "opens in English" rule would hold
  // only for some people. A controller switching language still keeps it
  // while they navigate — the switcher links to the prefixed path.
  localeDetection: false,
});
