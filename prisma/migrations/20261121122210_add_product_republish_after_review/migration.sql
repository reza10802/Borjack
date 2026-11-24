
-- تبدیل مقادیر قدیمی روش ارسال به POST و حذف روش‌های آزمایشی
-- مقادیر مجاز نهایی: POST و POST_EXPRESS

-- AlterEnum
BEGIN;

CREATE TYPE "ShippingMethod_new" AS ENUM ('POST', 'POST_EXPRESS');

ALTER TABLE "Order"
ALTER COLUMN "shippingMethod" TYPE "ShippingMethod_new"
USING (
  CASE
    WHEN "shippingMethod"::text IN ('SNAPPBOX', 'TIPAX') THEN 'POST'
    ELSE "shippingMethod"::text
  END
)::"ShippingMethod_new";

ALTER TABLE "OrderFulfillment"
ALTER COLUMN "shippingMethod" TYPE "ShippingMethod_new"
USING (
  CASE
    WHEN "shippingMethod"::text IN ('SNAPPBOX', 'TIPAX') THEN 'POST'
    ELSE "shippingMethod"::text
  END
)::"ShippingMethod_new";

ALTER TYPE "ShippingMethod" RENAME TO "ShippingMethod_old";
ALTER TYPE "ShippingMethod_new" RENAME TO "ShippingMethod";

DROP TYPE "public"."ShippingMethod_old";

COMMIT;

-- AlterTable: اطلاعات مالی سفارش
ALTER TABLE "Order"
ADD COLUMN "couponDiscount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "gatewayFee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Snapshot مالی اقلام سفارش
ALTER TABLE "OrderItem"
ADD COLUMN "basePriceAtPurchase" INTEGER,
ADD COLUMN "commissionAmountAtPurchase" INTEGER,
ADD COLUMN "commissionPercentAtPurchase" INTEGER,
ADD COLUMN "originalPriceAtPurchase" INTEGER,
ADD COLUMN "supplierDiscountAmountAtPurchase" INTEGER,
ADD COLUMN "supplierDiscountPercentAtPurchase" INTEGER,
ADD COLUMN "supplierPayoutAtPurchase" INTEGER;

-- AlterTable: قیمت‌گذاری و چرخه بررسی محصول
ALTER TABLE "Product"
ADD COLUMN "basePrice" INTEGER,
ADD COLUMN "commissionPercent" INTEGER,
ADD COLUMN "republishAfterReview" BOOLEAN NOT NULL DEFAULT false;
