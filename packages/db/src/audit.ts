import { Prisma, type PrismaClient } from "@prisma/client";

/**
 * CLAUDE.md rule (Faz 4 acceptance criteria) — every mutation is written
 * to AuditLog automatically as { actor, action, entity, entityId, before,
 * after, at }. AuditLog itself is append-only by construction (nothing
 * ever updates or deletes it — see immutable.ts, which does not need to
 * special-case it precisely because this extension never issues anything
 * but `create` against it).
 *
 * `withAudit` is a factory, not a static extension, because the actor and
 * IP are per-request context that Prisma has no built-in way to thread
 * through a query — callers build a request-scoped client:
 *
 *   const auditedDb = db.$extends(withAudit(rawClient, { actorId, ip }));
 *   await auditedDb.flight.create({ data: ... }); // audited automatically
 *
 * `rawClient` is the *unextended* base PrismaClient, used only for the
 * auxiliary before-read (findUnique) and the AuditLog write itself. Query
 * extension callbacks are NOT bound to a full model-delegate client via
 * `this` (that's a client-extension concept, not a query-extension one),
 * so those auxiliary calls go through the raw client explicitly rather
 * than an assumed `this`. The primary mutation still flows through the
 * extension chain via `query(args)`, so immutability/other extensions
 * still apply to it.
 */
export interface AuditContext {
  actorId?: string;
  ip?: string;
}

export function withAudit(rawClient: PrismaClient, context: AuditContext) {
  return Prisma.defineExtension({
    name: "audit-log",
    query: {
      $allModels: {
        async create({ model, operation, args, query }) {
          const result = await query(args);
          if (model !== "AuditLog") {
            await writeAuditLog(rawClient, model, operation, entityIdOf(result), null, result, context);
          }
          return result;
        },
        async update({ model, operation, args, query }) {
          const before = model !== "AuditLog" ? await readBefore(rawClient, model, args.where) : null;
          const result = await query(args);
          if (model !== "AuditLog") {
            await writeAuditLog(rawClient, model, operation, entityIdOf(result), before, result, context);
          }
          return result;
        },
        async updateMany({ model, operation, args, query }) {
          const result = await query(args);
          if (model !== "AuditLog") {
            await writeAuditLog(rawClient, model, operation, "(bulk)", null, { count: result.count, args }, context);
          }
          return result;
        },
        async delete({ model, operation, args, query }) {
          const before = model !== "AuditLog" ? await readBefore(rawClient, model, args.where) : null;
          const result = await query(args);
          if (model !== "AuditLog") {
            await writeAuditLog(rawClient, model, operation, entityIdOf(result) ?? entityIdOf(before), before, null, context);
          }
          return result;
        },
        async deleteMany({ model, operation, args, query }) {
          const result = await query(args);
          if (model !== "AuditLog") {
            await writeAuditLog(rawClient, model, operation, "(bulk)", null, { count: result.count, args }, context);
          }
          return result;
        },
      },
    },
  });
}

function entityIdOf(record: unknown): string | null {
  if (record && typeof record === "object" && "id" in record) {
    return String((record as { id: unknown }).id);
  }
  return null;
}

async function readBefore(rawClient: PrismaClient, model: string, where: unknown): Promise<unknown> {
  const modelKey = (model.charAt(0).toLowerCase() + model.slice(1)) as keyof PrismaClient;
  const delegate = rawClient[modelKey] as unknown as
    | { findUnique: (args: { where: unknown }) => Promise<unknown> }
    | undefined;
  if (!delegate) return null;
  return delegate.findUnique({ where });
}

async function writeAuditLog(
  rawClient: PrismaClient,
  model: string,
  action: string,
  entityId: string | null,
  before: unknown,
  after: unknown,
  context: AuditContext,
): Promise<void> {
  await rawClient.auditLog.create({
    data: {
      action,
      entity: model,
      entityId: entityId ?? "(unknown)",
      before: (before as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      after: (after as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      actorId: context.actorId ?? null,
      ip: context.ip ?? null,
    },
  });
}

export type AuditedPrismaClient = ReturnType<PrismaClient["$extends"]>;
