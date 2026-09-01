-- AlterTable
ALTER TABLE "ulds" ADD COLUMN     "currentFlightId" TEXT;

-- CreateTable
CREATE TABLE "uld_movements" (
    "id" TEXT NOT NULL,
    "uldId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "flightId" TEXT,
    "note" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,

    CONSTRAINT "uld_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uld_movements_uldId_recordedAt_idx" ON "uld_movements"("uldId", "recordedAt");

-- AddForeignKey
ALTER TABLE "ulds" ADD CONSTRAINT "ulds_currentFlightId_fkey" FOREIGN KEY ("currentFlightId") REFERENCES "flights"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uld_movements" ADD CONSTRAINT "uld_movements_uldId_fkey" FOREIGN KEY ("uldId") REFERENCES "ulds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uld_movements" ADD CONSTRAINT "uld_movements_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uld_movements" ADD CONSTRAINT "uld_movements_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "flights"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uld_movements" ADD CONSTRAINT "uld_movements_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
