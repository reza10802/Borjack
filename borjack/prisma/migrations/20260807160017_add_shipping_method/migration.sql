-- CreateEnum
CREATE TYPE "ShippingMethod" AS ENUM ('POST', 'SNAPPBOX', 'TIPAX');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "shippingCost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shippingMethod" "ShippingMethod",
ADD COLUMN     "trackingCode" TEXT;
