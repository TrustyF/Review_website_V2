-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "digestBannerImage" TEXT,
    "digestBannerHeadline" TEXT,
    "digestBannerSubtitle" TEXT,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
