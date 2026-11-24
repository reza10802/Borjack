-- CreateEnum
CREATE TYPE "AdminOrderSmsStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "AdminOrderSmsRecipient" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "mobile" TEXT NOT NULL,
    "status" "AdminOrderSmsStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "messageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminOrderSmsRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminOrderSmsRecipient_orderId_status_idx" ON "AdminOrderSmsRecipient"("orderId", "status");

-- CreateIndex
CREATE INDEX "AdminOrderSmsRecipient_status_createdAt_idx" ON "AdminOrderSmsRecipient"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminOrderSmsRecipient_orderId_mobile_key" ON "AdminOrderSmsRecipient"("orderId", "mobile");

-- AddForeignKey
ALTER TABLE "AdminOrderSmsRecipient" ADD CONSTRAINT "AdminOrderSmsRecipient_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
