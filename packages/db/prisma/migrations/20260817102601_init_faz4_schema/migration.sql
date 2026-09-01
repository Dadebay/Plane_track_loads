-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'LOAD_CONTROLLER', 'CHECKER', 'RAMP', 'VIEWER');

-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('RESERVED', 'PLANNED', 'LOADING', 'FINALIZED', 'DEPARTED', 'ARRIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoadPlanStatus" AS ENUM ('DRAFT', 'FINALIZED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "Deck" AS ENUM ('MAIN', 'LOWER');

-- CreateEnum
CREATE TYPE "UldStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "UldCondition" AS ENUM ('SERVICEABLE', 'DAMAGED', 'UNSERVICEABLE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('LIR', 'LS', 'ENV', 'NOTOC');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stationId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stations" (
    "id" TEXT NOT NULL,
    "iata" TEXT NOT NULL,
    "icao" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aircraft" (
    "id" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "msn" TEXT,
    "ahmDataRef" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "aircraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ahm_documents" (
    "id" TEXT NOT NULL,
    "aircraftType" TEXT NOT NULL,
    "edition" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "dataPath" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,

    CONSTRAINT "ahm_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flights" (
    "id" TEXT NOT NULL,
    "flightNo" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "serviceType" TEXT NOT NULL,
    "status" "FlightStatus" NOT NULL DEFAULT 'RESERVED',
    "aircraftId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_legs" (
    "id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "via" TEXT,
    "stdDep" TIMESTAMP(3) NOT NULL,
    "staArr" TIMESTAMP(3) NOT NULL,
    "etdDep" TIMESTAMP(3),
    "atdDep" TIMESTAMP(3),
    "flightId" TEXT NOT NULL,
    "fromStationId" TEXT NOT NULL,
    "toStationId" TEXT NOT NULL,

    CONSTRAINT "flight_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "load_plans" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "LoadPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "legId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "load_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "load_items" (
    "id" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "uldCode" TEXT,
    "awb" TEXT,
    "weight" DECIMAL(10,1) NOT NULL,
    "contentCode" TEXT,
    "deck" "Deck" NOT NULL,
    "loadPlanId" TEXT NOT NULL,

    CONSTRAINT "load_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ulds" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "typeCode" TEXT NOT NULL,
    "serial" TEXT,
    "ownerCode" TEXT,
    "status" "UldStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "UldCondition" NOT NULL DEFAULT 'SERVICEABLE',
    "baseplateCode" TEXT,
    "assignedStationId" TEXT,
    "currentStationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ulds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_records" (
    "id" TEXT NOT NULL,
    "density" DECIMAL(5,3) NOT NULL,
    "takeoffFuel" DECIMAL(10,1) NOT NULL,
    "tripFuel" DECIMAL(10,1) NOT NULL,
    "taxiFuel" DECIMAL(10,1) NOT NULL,
    "legId" TEXT NOT NULL,

    CONSTRAINT "fuel_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wnb_calculations" (
    "id" TEXT NOT NULL,
    "edition" INTEGER NOT NULL,
    "inputHash" TEXT NOT NULL,
    "resultJson" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legId" TEXT NOT NULL,
    "ahmDocumentId" TEXT NOT NULL,

    CONSTRAINT "wnb_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "edition" INTEGER NOT NULL,
    "pdfPath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legId" TEXT NOT NULL,
    "preparedById" TEXT NOT NULL,
    "checkedById" TEXT NOT NULL,
    "approvedById" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "actorId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "stations_iata_key" ON "stations"("iata");

-- CreateIndex
CREATE UNIQUE INDEX "stations_icao_key" ON "stations"("icao");

-- CreateIndex
CREATE UNIQUE INDEX "aircraft_registration_key" ON "aircraft"("registration");

-- CreateIndex
CREATE UNIQUE INDEX "ahm_documents_aircraftType_edition_revision_key" ON "ahm_documents"("aircraftType", "edition", "revision");

-- CreateIndex
CREATE INDEX "flights_aircraftId_date_idx" ON "flights"("aircraftId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "flight_legs_flightId_seq_key" ON "flight_legs"("flightId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "load_plans_legId_version_key" ON "load_plans"("legId", "version");

-- CreateIndex
CREATE INDEX "load_items_loadPlanId_idx" ON "load_items"("loadPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "ulds_code_key" ON "ulds"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fuel_records_legId_key" ON "fuel_records"("legId");

-- CreateIndex
CREATE INDEX "wnb_calculations_legId_edition_idx" ON "wnb_calculations"("legId", "edition");

-- CreateIndex
CREATE UNIQUE INDEX "documents_sha256_key" ON "documents"("sha256");

-- CreateIndex
CREATE INDEX "documents_legId_type_edition_idx" ON "documents"("legId", "type", "edition");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flights" ADD CONSTRAINT "flights_aircraftId_fkey" FOREIGN KEY ("aircraftId") REFERENCES "aircraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_legs" ADD CONSTRAINT "flight_legs_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "flights"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_legs" ADD CONSTRAINT "flight_legs_fromStationId_fkey" FOREIGN KEY ("fromStationId") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_legs" ADD CONSTRAINT "flight_legs_toStationId_fkey" FOREIGN KEY ("toStationId") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_plans" ADD CONSTRAINT "load_plans_legId_fkey" FOREIGN KEY ("legId") REFERENCES "flight_legs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_plans" ADD CONSTRAINT "load_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "load_items" ADD CONSTRAINT "load_items_loadPlanId_fkey" FOREIGN KEY ("loadPlanId") REFERENCES "load_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ulds" ADD CONSTRAINT "ulds_assignedStationId_fkey" FOREIGN KEY ("assignedStationId") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ulds" ADD CONSTRAINT "ulds_currentStationId_fkey" FOREIGN KEY ("currentStationId") REFERENCES "stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_records" ADD CONSTRAINT "fuel_records_legId_fkey" FOREIGN KEY ("legId") REFERENCES "flight_legs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wnb_calculations" ADD CONSTRAINT "wnb_calculations_legId_fkey" FOREIGN KEY ("legId") REFERENCES "flight_legs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wnb_calculations" ADD CONSTRAINT "wnb_calculations_ahmDocumentId_fkey" FOREIGN KEY ("ahmDocumentId") REFERENCES "ahm_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_legId_fkey" FOREIGN KEY ("legId") REFERENCES "flight_legs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- CLAUDE.md rule #7: prepared_by <> checked_by, enforced by the database
-- itself (not just application code) — a DB-level CHECK constraint, since
-- Prisma's schema DSL has no CHECK syntax.
-- =============================================================================
ALTER TABLE "documents" ADD CONSTRAINT "documents_prepared_checked_distinct"
  CHECK ("preparedById" <> "checkedById");

-- =============================================================================
-- CLAUDE.md rule #5: WnbCalculation and Document are INSERT only. This is
-- the database-layer half of the immutability guard (the Prisma client
-- extension in packages/db/src/immutable.ts is the application-layer
-- half) — it rejects UPDATE/DELETE even for a client that bypasses Prisma
-- entirely (raw SQL, psql, a different service).
-- =============================================================================
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is immutable (INSERT only, CLAUDE.md rule #5) — % is not allowed on table %',
    TG_TABLE_NAME, TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wnb_calculations_immutable
  BEFORE UPDATE OR DELETE ON "wnb_calculations"
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER documents_immutable
  BEFORE UPDATE OR DELETE ON "documents"
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
