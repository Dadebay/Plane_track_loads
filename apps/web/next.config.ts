import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // Served under a sub-path on the operator's server: the TLS certificate
  // that already works there covers akbulut.com.tm only, and that host
  // cannot reach Let's Encrypt (the same SNI-based block that hides
  // registry.npmjs.org), so a sub-domain could not be given HTTPS at all.
  // Set at BUILD time — Next bakes the prefix into every asset URL, so a
  // bundle built without it cannot be mounted under a prefix later, and a
  // bundle built with it cannot be served at the root. Left unset for
  // local development and for the Docker compose files, which both serve
  // from "/".
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  transpilePackages: ["@tua/ui", "@tua/wnb-core", "@tua/ahm-data", "@tua/documents", "@tua/compare"],
  // @react-pdf/renderer's reconciler breaks if webpack bundles/minifies it
  // (loses internal state its reconciler depends on) — must be required
  // natively by Node instead. This only takes effect because
  // @react-pdf/renderer is ALSO a direct dependency of this package (see
  // package.json) — pnpm's strict node_modules means Next can't resolve
  // it for externalization through @tua/documents's dependency alone.
  // @prisma/client resolves its native query-engine binary relative to its
  // own __dirname at runtime — if webpack bundles it into a route chunk
  // (the default), __dirname points at .next internals instead of the
  // real package directory and the engine can never be found. Keeping it
  // (and @tua/db, which re-exports it) external forces Next to leave them
  // as a real node_modules require, same reasoning as @react-pdf/renderer.
  serverExternalPackages: ["@react-pdf/renderer", "@prisma/client", "@tua/db"],
  // The airline mark is read from disk at render time (documents/src/shared/
  // logo.tsx), not imported, so Next's dependency tracing cannot see it and a
  // standalone build would ship without it — every generated PDF would fall
  // back to the plain disc. Name it explicitly.
  outputFileTracingIncludes: {
    "**": ["../../packages/documents/assets/**"],
  },
  experimental: {
    typedRoutes: true,
  },
};

export default withNextIntl(nextConfig);
