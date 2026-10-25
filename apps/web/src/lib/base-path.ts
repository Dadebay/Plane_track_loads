/**
 * The path prefix the app is mounted under, or "" when it is served from
 * the root. On akbulut it is "/load"; local development and the Docker
 * compose files leave it unset and serve from "/".
 *
 * Two places need it and neither can read the other's: next.config.ts
 * feeds Next's own `basePath` from it, and middleware.ts has to prepend it
 * by hand. Next prefixes basePath onto the URLs it generates itself —
 * pages, /_next assets, Link hrefs, its own trailing-slash 308s — but NOT
 * onto a redirect built inside middleware. Verified against a standalone
 * build: without this, /load/uld answers 302 -> /en/login, the prefix
 * gone, and the browser lands on the main site's 404 instead of the login
 * form. With it, the same request answers 302 -> /load/en/login.
 *
 * NEXT_PUBLIC_ on purpose: middleware runs on the Edge runtime, where only
 * the inlined public variables are reliably present at runtime.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefixes an app-absolute path with BASE_PATH. */
export function withBasePath(pathname: string): string {
  return `${BASE_PATH}${pathname}`;
}
