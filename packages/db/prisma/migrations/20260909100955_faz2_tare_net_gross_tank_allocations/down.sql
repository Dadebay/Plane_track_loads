-- Manual rollback for 20260909100955_faz2_tare_net_gross_tank_allocations.
--
-- Prisma Migrate has no down migrations; this file is the documented reverse,
-- to be run by hand (psql) if the forward migration has to be undone. The
-- forward migration is purely additive, so this drops only what it added and
-- touches no pre-existing column or row.
--
-- Data loss on rollback: every tare/net breakdown, every tank allocation,
-- every offload attribution and every WnbCalculation.inputJson snapshot.
-- wnb_calculations is INSERT-only, so dropping its column is the one action
-- here that cannot be undone by re-running the forward migration.

ALTER TABLE "load_items" DROP CONSTRAINT IF EXISTS "load_items_gross_is_tare_plus_net";
ALTER TABLE "load_items" DROP CONSTRAINT IF EXISTS "load_items_weights_non_negative";
ALTER TABLE "load_items" DROP CONSTRAINT IF EXISTS "load_items_offload_is_attributed";
ALTER TABLE "fuel_tank_allocations" DROP CONSTRAINT IF EXISTS "fuel_tank_allocations_weight_non_negative";
ALTER TABLE "fuel_tank_allocations" DROP CONSTRAINT IF EXISTS "fuel_tank_allocations_side_matches_tank";

DROP TABLE IF EXISTS "fuel_tank_allocations";

ALTER TABLE "load_items"
  DROP COLUMN IF EXISTS "tareWeight",
  DROP COLUMN IF EXISTS "netWeight",
  DROP COLUMN IF EXISTS "uldId",
  DROP COLUMN IF EXISTS "offloadedAt",
  DROP COLUMN IF EXISTS "offloadedById",
  DROP COLUMN IF EXISTS "offloadReason";

ALTER TABLE "load_plans" DROP COLUMN IF EXISTS "ahmDocumentId";
ALTER TABLE "fuel_records" DROP COLUMN IF EXISTS "refuelMode";
ALTER TABLE "wnb_calculations" DROP COLUMN IF EXISTS "inputJson";

DROP TYPE IF EXISTS "FuelTank";
DROP TYPE IF EXISTS "TankSide";
DROP TYPE IF EXISTS "RefuelMode";
