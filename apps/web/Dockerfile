# Multi-stage build for the Next.js app, run from the monorepo root:
#   docker build -f apps/web/Dockerfile -t tua-web .
# Production-hardened per Faz 15: standalone output keeps the runtime
# stage to just the traced files (no full node_modules), non-root user,
# HEALTHCHECK against /api/health.

FROM node:20-alpine AS base
RUN corepack enable

# ---- deps ----
FROM base AS deps
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/wnb-core/package.json packages/wnb-core/package.json
COPY packages/ahm-data/package.json packages/ahm-data/package.json
COPY packages/documents/package.json packages/documents/package.json
COPY packages/messaging/package.json packages/messaging/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM base AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN pnpm --filter @tua/web... build

# ---- migrator (full toolchain — `prisma migrate deploy` needs the CLI and
#      schema/migrations directory, neither of which the standalone runtime
#      image below carries; this stage reuses `builder`'s complete
#      node_modules instead of relying on `npx prisma` fetching at runtime) ----
FROM builder AS migrator
WORKDIR /repo
CMD ["pnpm", "--filter", "@tua/db", "exec", "prisma", "migrate", "deploy"]

# ---- runtime ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /repo/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static

# document-storage.ts / message-transport.ts write generated PDFs and the
# message outbox under $PWD/.data by default — that's this stage's WORKDIR,
# so it must exist and be owned by the runtime user before USER switches
# below, or the app's own `mkdir(..., {recursive:true})` fails at request
# time. compose.prod.yaml mounts a named volume here so it survives
# container recreation (see docs/DEPLOYMENT.md).
RUN mkdir -p /app/.data && chown -R nextjs:nodejs /app/.data

USER nextjs
EXPOSE 3000
ENV PORT=3000

# wget is BusyBox-provided on alpine, no extra install needed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
