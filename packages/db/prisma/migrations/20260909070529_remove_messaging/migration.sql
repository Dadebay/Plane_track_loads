-- Faz 13 messaging module removed (customer request — LDM/CPM/MVT/FFM/FBL
-- IATA messaging not needed).

-- DropForeignKey
ALTER TABLE "outgoing_messages" DROP CONSTRAINT "outgoing_messages_addressId_fkey";

-- DropForeignKey
ALTER TABLE "outgoing_messages" DROP CONSTRAINT "outgoing_messages_createdById_fkey";

-- DropForeignKey
ALTER TABLE "outgoing_messages" DROP CONSTRAINT "outgoing_messages_legId_fkey";

-- DropTable
DROP TABLE "message_addresses";

-- DropTable
DROP TABLE "outgoing_messages";

-- DropEnum
DROP TYPE "MessageType";

-- DropEnum
DROP TYPE "OutgoingMessageStatus";
