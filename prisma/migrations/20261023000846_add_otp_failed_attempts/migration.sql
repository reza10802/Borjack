/*
  Warnings:

  - The values [LOGIN] on the enum `OtpPurpose` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OtpPurpose_new" AS ENUM ('VERIFY_PHONE', 'RESET_PASSWORD');
ALTER TABLE "OtpCode" ALTER COLUMN "purpose" TYPE "OtpPurpose_new" USING ("purpose"::text::"OtpPurpose_new");
ALTER TYPE "OtpPurpose" RENAME TO "OtpPurpose_old";
ALTER TYPE "OtpPurpose_new" RENAME TO "OtpPurpose";
DROP TYPE "public"."OtpPurpose_old";
COMMIT;

-- AlterTable
ALTER TABLE "OtpCode" ADD COLUMN     "failedAttempts" INTEGER NOT NULL DEFAULT 0;
