/*
  Warnings:

  - The primary key for the `OtpCode` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `used` on the `OtpCode` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "OtpCode" DROP CONSTRAINT "OtpCode_pkey",
DROP COLUMN "used",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "OtpCode_id_seq";
