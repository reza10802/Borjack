-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('PREPARING', 'READY_FOR_HANDOVER', 'HANDED_TO_CARRIER', 'SHIPPED', 'DELIVERED', 'ISSUE');

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "supplierSnapshotCaptured" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OrderFulfillment" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "supplierId" TEXT,
    "sellerKey" TEXT NOT NULL,
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'PREPARING',
    "shippingMethod" "ShippingMethod",
    "shippingCost" INTEGER NOT NULL DEFAULT 0,
    "handedOverAt" TIMESTAMP(3),
    "trackingCode" TEXT,
    "trackingCodeAddedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "issueNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentItem" (
    "id" SERIAL NOT NULL,
    "fulfillmentId" TEXT NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "FulfillmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderFulfillment_supplierId_status_createdAt_idx" ON "OrderFulfillment"("supplierId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderFulfillment_orderId_status_idx" ON "OrderFulfillment"("orderId", "status");

-- CreateIndex
CREATE INDEX "OrderFulfillment_trackingCode_idx" ON "OrderFulfillment"("trackingCode");

-- CreateIndex
CREATE UNIQUE INDEX "OrderFulfillment_orderId_sellerKey_key" ON "OrderFulfillment"("orderId", "sellerKey");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentItem_orderItemId_key" ON "FulfillmentItem"("orderItemId");

-- CreateIndex
CREATE INDEX "FulfillmentItem_fulfillmentId_idx" ON "FulfillmentItem"("fulfillmentId");

-- CreateIndex
CREATE INDEX "OrderItem_supplierId_idx" ON "OrderItem"("supplierId");

-- CreateIndex
CREATE INDEX "OrderItem_supplierSnapshotCaptured_idx" ON "OrderItem"("supplierSnapshotCaptured");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFulfillment" ADD CONSTRAINT "OrderFulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFulfillment" ADD CONSTRAINT "OrderFulfillment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "OrderFulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
