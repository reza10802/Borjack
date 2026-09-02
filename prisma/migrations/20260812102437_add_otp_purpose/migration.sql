/*
  Warnings:

  - Added the required column `purpose` to the `OtpCode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('VERIFY_PHONE', 'RESET_PASSWORD');

-- DropIndex
DROP INDEX "OtpCode_phone_idx";

-- AlterTable
ALTER TABLE "OtpCode" ADD COLUMN     "purpose" "OtpPurpose" NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "OtpCode_phone_purpose_idx" ON "OtpCode"("phone", "purpose");
