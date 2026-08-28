-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CRON_JOB_FAILED';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "message" TEXT;
