-- Security remediation migration (Borjak). Idempotent where practical. Review before running in production.

-- User: session revocation + restore profile fields used by the app
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;

-- Order: idempotent restock marker
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stockRestockedAt" TIMESTAMP(3);

-- AuditLog: keep history when a user is deleted
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userLabel" TEXT;
ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;
UPDATE "AuditLog" a SET "userLabel" = u."name" FROM "User" u WHERE a."userId" = u."id" AND a."userLabel" IS NULL;
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Scrub password hashes that older code wrote into audit logs (record itself is kept)
UPDATE "AuditLog" SET "oldValue" = "oldValue" - 'password' WHERE jsonb_typeof("oldValue") = 'object' AND "oldValue" ? 'password';
UPDATE "AuditLog" SET "newValue" = "newValue" - 'password' WHERE jsonb_typeof("newValue") = 'object' AND "newValue" ? 'password';

-- OTP: codes are now stored as HMAC hashes. Invalidate/scrub any plaintext codes still in the table.
UPDATE "OtpCode" SET "code" = 'migrated', "used" = true WHERE length("code") <= 10;

-- Transaction history must not be cascade-deleted with an order
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_orderId_fkey";
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New tables
CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);
CREATE TABLE IF NOT EXISTS "PaymentAttempt" (
  "id" TEXT NOT NULL,
  "orderId" INTEGER NOT NULL,
  "userId" TEXT,
  "authority" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "gateway" TEXT NOT NULL DEFAULT 'ZARINPAL',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "refId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAttempt_authority_key" ON "PaymentAttempt"("authority");

-- Indexes (query-pattern driven)
CREATE INDEX IF NOT EXISTS "RateLimitBucket_windowStart_idx" ON "RateLimitBucket"("windowStart");
CREATE INDEX IF NOT EXISTS "PaymentAttempt_orderId_idx" ON "PaymentAttempt"("orderId");
CREATE INDEX IF NOT EXISTS "PaymentAttempt_status_idx" ON "PaymentAttempt"("status");
CREATE INDEX IF NOT EXISTS "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS "Address_userId_idx" ON "Address"("userId");
CREATE INDEX IF NOT EXISTS "Review_productId_approved_idx" ON "Review"("productId", "approved");
CREATE INDEX IF NOT EXISTS "Order_userId_paymentStatus_status_idx" ON "Order"("userId", "paymentStatus", "status");
CREATE INDEX IF NOT EXISTS "Order_paymentStatus_status_idx" ON "Order"("paymentStatus", "status");

-- DB-03: (re)assert stock CHECK constraints so they survive resets/restores of this migration chain
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_stock_nonnegative_check') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_nonnegative_check" CHECK ("stock" >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_reservedStock_nonnegative_check') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_reservedStock_nonnegative_check" CHECK ("reservedStock" >= 0); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_reservedStock_not_exceed_stock_check') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_reservedStock_not_exceed_stock_check" CHECK ("reservedStock" <= "stock"); END IF;
END $$;
