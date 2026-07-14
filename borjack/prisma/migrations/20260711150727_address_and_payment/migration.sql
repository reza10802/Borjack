/*
  Warnings:

  - The primary key for the `Address` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `city` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `province` on the `Address` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paymentAuthority` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `paymentRefId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `province` on the `Order` table. All the data in the column will be lost.
  - The `status` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `paymentStatus` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `phoneVerifiedAt` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[authority]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cityId` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cityName` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provinceId` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provinceName` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receiverName` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receiverPhone` to the `Address` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cityId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cityName` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provinceId` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provinceName` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Address_userId_idx";

-- DropIndex
DROP INDEX "Order_paymentAuthority_key";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "Address" DROP CONSTRAINT "Address_pkey",
DROP COLUMN "city",
DROP COLUMN "fullName",
DROP COLUMN "phone",
DROP COLUMN "province",
ADD COLUMN     "cityId" INTEGER NOT NULL,
ADD COLUMN     "cityName" TEXT NOT NULL,
ADD COLUMN     "provinceId" INTEGER NOT NULL,
ADD COLUMN     "provinceName" TEXT NOT NULL,
ADD COLUMN     "receiverName" TEXT NOT NULL,
ADD COLUMN     "receiverPhone" TEXT NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Address_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Address_id_seq";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "city",
DROP COLUMN "email",
DROP COLUMN "paymentAuthority",
DROP COLUMN "paymentRefId",
DROP COLUMN "province",
ADD COLUMN     "authority" TEXT,
ADD COLUMN     "cityId" INTEGER NOT NULL,
ADD COLUMN     "cityName" TEXT NOT NULL,
ADD COLUMN     "provinceId" INTEGER NOT NULL,
ADD COLUMN     "provinceName" TEXT NOT NULL,
ADD COLUMN     "refId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
DROP COLUMN "paymentStatus",
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "phoneVerifiedAt";

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "authority" TEXT NOT NULL,
    "refId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "gateway" TEXT NOT NULL DEFAULT 'ZARINPAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_orderId_key" ON "Transaction"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_authority_key" ON "Transaction"("authority");

-- CreateIndex
CREATE UNIQUE INDEX "Order_authority_key" ON "Order"("authority");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
