import { Prisma } from "@prisma/client";

/**
 * CLAUDE.md rule #5 — WnbCalculation and Document are INSERT only. A
 * correction is a new row (new edition, new calculation), never an
 * in-place update or a delete.
 *
 * This is the application-layer half of a two-layer guard: the Postgres
 * migration also adds a trigger (see
 * prisma/migrations/*_immutability_and_constraints/migration.sql) that
 * rejects the same operations even for a client that bypasses Prisma
 * entirely (raw SQL, a different service, psql). Neither guard alone is
 * sufficient — this one is easy to bypass with `$queryRaw`, the trigger
 * alone gives poor error messages and no early-exit before hitting the DB.
 */

const IMMUTABLE_MODELS = new Set(["WnbCalculation", "Document"]);

function reject(model: string, operation: string): never {
  throw new Error(
    `${model} is immutable (INSERT only, CLAUDE.md rule #5) — "${operation}" is not allowed. ` +
      `Create a new row (new edition) instead of modifying an existing one.`,
  );
}

export const immutableRecordsExtension = Prisma.defineExtension({
  name: "immutable-records",
  query: {
    $allModels: {
      async update({ model, operation, args, query }) {
        if (IMMUTABLE_MODELS.has(model)) reject(model, operation);
        return query(args);
      },
      async updateMany({ model, operation, args, query }) {
        if (IMMUTABLE_MODELS.has(model)) reject(model, operation);
        return query(args);
      },
      async upsert({ model, operation, args, query }) {
        if (IMMUTABLE_MODELS.has(model)) reject(model, operation);
        return query(args);
      },
      async delete({ model, operation, args, query }) {
        if (IMMUTABLE_MODELS.has(model)) reject(model, operation);
        return query(args);
      },
      async deleteMany({ model, operation, args, query }) {
        if (IMMUTABLE_MODELS.has(model)) reject(model, operation);
        return query(args);
      },
    },
  },
});
