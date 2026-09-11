/**
 * @tua/db — Prisma client + schema.
 *
 * `db` is the base client with the immutability guard always applied
 * (WnbCalculation/Document are INSERT only — CLAUDE.md rule #5, enforced
 * both here and by a Postgres trigger, see prisma/migrations/).
 *
 * `auditedDb(context)` layers request-scoped audit logging on top — build
 * one per request/action with the acting user and IP:
 *
 *   const scoped = auditedDb({ actorId: session.user.id, ip: req.ip });
 *   await scoped.flight.update({ where: { id }, data: { status: "PLANNED" } });
 */

import { PrismaClient } from "@prisma/client";
import { immutableRecordsExtension } from "./immutable";
import { withAudit, type AuditContext } from "./audit";

export const DB_VERSION = "0.0.0-faz4";

/**
 * One client per process, cached on `globalThis` in development.
 *
 * Next.js hot-reloads a module graph on every edit. Without this cache each
 * reload constructs another `PrismaClient`, each opens its own connection
 * pool, and none of the old ones are closed — Postgres runs out of
 * connections after a few minutes of editing ("too many clients already")
 * and every page starts failing. Production builds load the module once, so
 * the cache is a no-op there.
 */
const globalForPrisma = globalThis as unknown as { tuaPrismaClient?: PrismaClient };

const basePrismaClient = globalForPrisma.tuaPrismaClient ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.tuaPrismaClient = basePrismaClient;

export const db = basePrismaClient.$extends(immutableRecordsExtension);

export function auditedDb(context: AuditContext) {
  return db.$extends(withAudit(basePrismaClient, context));
}

export * from "@prisma/client";
export type { AuditContext } from "./audit";
