import NextAuth from "next-auth";
import createMiddleware from "next-intl/middleware";
import { authConfig } from "./auth.config";
import { routing } from "./i18n/routing";
import { withBasePath } from "./lib/base-path";

// Edge-safe auth() built from the lightweight config — see auth.config.ts.
const { auth } = NextAuth(authConfig);

const intlMiddleware = createMiddleware(routing);

// Paths that don't require a session. Matched by suffix after the locale
// segment, e.g. "/tk/login" -> "/login".
const PUBLIC_PATHS = ["/login"];

// Route prefixes that require a specific role beyond "authenticated" —
// AHM master data and user administration are ADMIN-only, and so is the ULD
// stock: the operator wants the containers managed centrally rather than by
// whoever is on the ramp. Hiding the nav entry is not enough on its own, so
// the route itself is checked here.
const ROLE_PROTECTED_PREFIXES: { prefix: string; role: "ADMIN" }[] = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/uld", role: "ADMIN" },
];

function stripLocale(pathname: string): string {
  const segments = pathname.split("/");
  const maybeLocale = segments[1];
  if ((routing.locales as readonly string[]).includes(maybeLocale ?? "")) {
    return "/" + segments.slice(2).join("/");
  }
  return pathname;
}

/**
 * The origin to build redirects against: what the browser actually asked
 * for, not what the server thinks it is.
 *
 * req.nextUrl.origin is wrong behind the reverse proxy. The app binds to
 * 127.0.0.1 (HOSTNAME in .env, so nginx is the only way in) and Next
 * composes nextUrl's origin from that bind address, giving
 * "https://localhost:3000" — a Location header pointing at the visitor's
 * own machine. Verified in production: /load/en answered
 * 302 -> https://localhost:3000/load/en/login and the login form was
 * unreachable. The forwarded headers carry the real public origin; nginx
 * sets all three on every proxied request (tools/nginx/load.conf), and the
 * app is never exposed directly, so they cannot be spoofed by a client.
 * The nextUrl fallback is for local development, where there is no proxy.
 */
function publicOrigin(req: { headers: Headers; nextUrl: { origin: string } }): string {
  const first = (v: string | null) => v?.split(",")[0]?.trim() || undefined;
  const proto = first(req.headers.get("x-forwarded-proto"));
  const host = first(req.headers.get("x-forwarded-host")) ?? first(req.headers.get("host"));
  return proto && host ? `${proto}://${host}` : req.nextUrl.origin;
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
    // withBasePath, because Next does not add the mount prefix to a
    // redirect built in middleware — see lib/base-path.ts. callbackUrl
    // keeps the unprefixed pathname: it is consumed by the app, which
    // prefixes it again when it navigates there.
    const loginUrl = new URL(withBasePath(`/${locale}/login`), publicOrigin(req));
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
      return Response.redirect(new URL(withBasePath(`/${locale}`), publicOrigin(req)));
    }
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
