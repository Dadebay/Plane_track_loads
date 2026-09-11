-- CreateEnum
CREATE TYPE "FuelTank" AS ENUM ('INNER', 'OUTER', 'CENTER', 'TRIM');

-- CreateEnum
CREATE TYPE "TankSide" AS ENUM ('LEFT', 'RIGHT', 'CENTRE');

-- CreateEnum
CREATE TYPE "RefuelMode" AS ENUM ('MANUAL', 'AUTOMATIC');

-- AlterTable
ALTER TABLE "fuel_records" ADD COLUMN     "refuelMode" "RefuelMode" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "load_items" ADD COLUMN     "netWeight" DECIMAL(10,1),
ADD COLUMN     "offloadReason" TEXT,
ADD COLUMN     "offloadedAt" TIMESTAMP(3),
ADD COLUMN     "offloadedById" TEXT,
ADD COLUMN     "tareWeight" DECIMAL(10,1),
ADD COLUMN     "uldId" TEXT;

-- AlterTable
ALTER TABLE "load_plans" ADD COLUMN     "ahmDocumentId" TEXT;

-- AlterTable
ALTER TABLE "wnb_calculations" ADD COLUMN     "inputJson" JSONB;

-- CreateTable
CREATE TABLE "fuel_tank_allocations" (
    "id" TEXT NOT NULL,
    "tank" "FuelTank" NOT NULL,
    "side" "TankSide" NOT NULL,
    "weight" DECIMAL(10,1) NOT NULL,
    "fuelRecordId" TEXT NOT NULL,

    CONSTRAINT "fuel_tank_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fuel_tank_allocations_fuelRecordId_tank_side_key" ON "fuel_tank_allocations"("fuelRecordId", "tank", "side");

-- CreateIndex
CREATE INDEX "load_items_uldId_idx" ON "load_items"("uldId");

-- AddForeignKey
ALTER TABLE "load_plans" ADD CONSTRAINT "load_plans_ahmDocumentId_fkey" FOREIGN KEY ("ahmDocumentId") REFERENCES "ahm_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_items" ADD CONSTRAINT "load_items_uldId_fkey" FOREIGN KEY ("uldId") REFERENCES "ulds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_items" ADD CONSTRAINT "load_items_offloadedById_fkey" FOREIGN KEY ("offloadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_tank_allocations" ADD CONSTRAINT "fuel_tank_allocations_fuelRecordId_fkey" FOREIGN KEY ("fuelRecordId") REFERENCES "fuel_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- Hand-added CHECK constraints. Prisma's schema DSL has no CHECK syntax, so
-- these live here the same way documents_prepared_checked_distinct does in the
-- initial migration.
-- =============================================================================

-- gross = tare + net. Only enforced when the breakdown is actually present:
-- loose load and rows written before this migration carry gross alone.
-- CLAUDE.md rule #2 — the columns are DECIMAL, so this is exact, not float.
ALTER TABLE "load_items" ADD CONSTRAINT "load_items_gross_is_tare_plus_net"
  CHECK (
    "tareWeight" IS NULL
    OR "netWeight" IS NULL
    OR "weight" = "tareWeight" + "netWeight"
  );

ALTER TABLE "load_items" ADD CONSTRAINT "load_items_weights_non_negative"
  CHECK (
    ("tareWeight" IS NULL OR "tareWeight" >= 0)
    AND ("netWeight" IS NULL OR "netWeight" >= 0)
  );

-- An offload is an audited event: who and when are recorded together, or not
-- at all. The row is never deleted, so the plan keeps the history.
ALTER TABLE "load_items" ADD CONSTRAINT "load_items_offload_is_attributed"
  CHECK (
    ("offloadedAt" IS NULL AND "offloadedById" IS NULL)
    OR ("offloadedAt" IS NOT NULL AND "offloadedById" IS NOT NULL)
  );

ALTER TABLE "fuel_tank_allocations" ADD CONSTRAINT "fuel_tank_allocations_weight_non_negative"
  CHECK ("weight" >= 0);

-- AHM 560 Appendix I s.75: INNER and OUTER are left/right pairs (footnote 1,
-- "weight and index per tank"); CENTER and TRIM sit on the centreline.
ALTER TABLE "fuel_tank_allocations" ADD CONSTRAINT "fuel_tank_allocations_side_matches_tank"
  CHECK (
    ("tank" IN ('INNER', 'OUTER') AND "side" IN ('LEFT', 'RIGHT'))
    OR ("tank" IN ('CENTER', 'TRIM') AND "side" = 'CENTRE')
  );
