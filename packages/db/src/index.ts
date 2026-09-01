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

const basePrismaClient = new PrismaClient();

export const db = basePrismaClient.$extends(immutableRecordsExtension);

export function auditedDb(context: AuditContext) {
  return db.$extends(withAudit(basePrismaClient, context));
}

export * from "@prisma/client";
export type { AuditContext } from "./audit";
