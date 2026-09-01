import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import { authConfig } from "./auth.config";
import { routing } from "./i18n/routing";

// Edge-safe auth() built from the lightweight config — see auth.config.ts.
const { auth } = NextAuth(authConfig);

const intlMiddleware = createMiddleware(routing);

// Paths that don't require a session. Matched by suffix after the locale
// segment, e.g. "/tk/login" -> "/login".
const PUBLIC_PATHS = ["/login"];

// Route prefixes that require a specific role beyond "authenticated" —
// AHM master data admin (Faz 5) is ADMIN-only.
const ROLE_PROTECTED_PREFIXES: { prefix: string; role: "ADMIN" }[] = [
  { prefix: "/admin", role: "ADMIN" },
];

function stripLocale(pathname: string): string {
  const segments = pathname.split("/");
  const maybeLocale = segments[1];
  if ((routing.locales as readonly string[]).includes(maybeLocale ?? "")) {
    return "/" + segments.slice(2).join("/");
  }
  return pathname;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const localeStripped = stripLocale(pathname) || "/";
  const isPublic = PUBLIC_PATHS.some((p) => localeStripped === p || localeStripped.startsWith(`${p}/`));

  if (!req.auth && !isPublic) {
    const segments = pathname.split("/");
    const locale = (routing.locales as readonly string[]).includes(segments[1] ?? "")
      ? segments[1]
      : routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  if (req.auth) {
    const restricted = ROLE_PROTECTED_PREFIXES.find(
      ({ prefix }) => localeStripped === prefix || localeStripped.startsWith(`${prefix}/`),
    );
    if (restricted && req.auth.user.role !== restricted.role) {
      const segments = pathname.split("/");
      const locale = (routing.locales as readonly string[]).includes(segments[1] ?? "")
        ? segments[1]
        : routing.defaultLocale;
      return Response.redirect(new URL(`/${locale}`, req.url));
    }
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
