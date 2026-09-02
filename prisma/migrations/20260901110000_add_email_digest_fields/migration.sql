-- AlterTable
ALTER TABLE "User" ADD COLUMN     "listAddEmailOptIn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "emailedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notification_userId_emailedAt_idx" ON "Notification"("userId", "emailedAt");
