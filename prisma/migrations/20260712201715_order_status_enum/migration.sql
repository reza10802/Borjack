/*
  Warnings:

  - The `status` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `paymentStatus` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Transaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LogAction" ADD VALUE 'BLOCK_USER';
ALTER TYPE "LogAction" ADD VALUE 'UNBLOCK_USER';
ALTER TYPE "LogAction" ADD VALUE 'LOGIN';
ALTER TYPE "LogAction" ADD VALUE 'LOGOUT';
ALTER TYPE "LogAction" ADD VALUE 'CREATE_TASK';
ALTER TYPE "LogAction" ADD VALUE 'UPDATE_TASK';
ALTER TYPE "LogAction" ADD VALUE 'DELETE_TASK';

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "paymentStatus",
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'PENDING';
