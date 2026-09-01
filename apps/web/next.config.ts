import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@tua/ui", "@tua/wnb-core", "@tua/ahm-data", "@tua/documents", "@tua/messaging", "@tua/compare"],
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
  experimental: {
    typedRoutes: true,
  },
};

export default withNextIntl(nextConfig);
