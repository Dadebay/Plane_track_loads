-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('LDM', 'CPM', 'MVT', 'FFM', 'FBL');

-- CreateEnum
CREATE TYPE "OutgoingMessageStatus" AS ENUM ('PENDING', 'RETRYING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "flight_legs" ADD COLUMN     "ataArr" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "message_addresses" (
    "id" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL,
    "label" TEXT NOT NULL,
    "sita" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "message_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outgoing_messages" (
    "id" TEXT NOT NULL,
    "messageType" "MessageType" NOT NULL,
    "body" TEXT NOT NULL,
    "status" "OutgoingMessageStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "legId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "outgoing_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outgoing_messages_legId_messageType_idx" ON "outgoing_messages"("legId", "messageType");

-- AddForeignKey
ALTER TABLE "outgoing_messages" ADD CONSTRAINT "outgoing_messages_legId_fkey" FOREIGN KEY ("legId") REFERENCES "flight_legs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outgoing_messages" ADD CONSTRAINT "outgoing_messages_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "message_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outgoing_messages" ADD CONSTRAINT "outgoing_messages_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
