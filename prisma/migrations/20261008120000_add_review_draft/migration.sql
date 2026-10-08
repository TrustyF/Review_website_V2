-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "bodyDraft" TEXT,
ADD COLUMN     "bodyFrDraft" TEXT,
ADD COLUMN     "draftUpdatedAt" TIMESTAMP(3);
