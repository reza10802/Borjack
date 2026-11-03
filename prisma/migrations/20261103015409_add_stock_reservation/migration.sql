-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('NONE', 'RESERVED', 'CONSUMED', 'RELEASED', 'ISSUE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "stockIssueAt" TIMESTAMP(3),
ADD COLUMN     "stockReservationStatus" "StockReservationStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "reservedStock" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Order_stockReservationStatus_paymentExpiresAt_idx" ON "Order"("stockReservationStatus", "paymentExpiresAt");

ALTER TABLE "Product"
ADD CONSTRAINT "Product_stock_nonnegative_check"
CHECK ("stock" >= 0);

ALTER TABLE "Product"
ADD CONSTRAINT "Product_reservedStock_nonnegative_check"
CHECK ("reservedStock" >= 0);

ALTER TABLE "Product"
ADD CONSTRAINT "Product_reservedStock_not_exceed_stock_check"
CHECK ("reservedStock" <= "stock");
