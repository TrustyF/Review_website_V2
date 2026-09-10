/*
  Warnings:

  - You are about to drop the column `digestBannerHeadline` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `digestBannerSubtitle` on the `Settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "digestBannerHeadline",
DROP COLUMN "digestBannerSubtitle";
