-- CreateEnum
CREATE TYPE "ProductReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "ProductReviewStatus" NOT NULL DEFAULT 'APPROVED';
