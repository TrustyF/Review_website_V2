-- Drop old CRON_JOB_* notification rows before narrowing the enum below.
DELETE FROM "Notification" WHERE "type" IN ('CRON_JOB_FAILED', 'CRON_JOB_SUCCEEDED');

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "message";

-- Narrow NotificationType: Postgres has no direct "drop enum value", so swap in a new type.
CREATE TYPE "NotificationType_new" AS ENUM ('LIST_CREATED', 'LIST_ITEM_ADDED');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
DROP TYPE "NotificationType";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";

-- CreateEnum
CREATE TYPE "CronJobStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "CronJobRun" (
    "id" SERIAL NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" "CronJobStatus" NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CronJobRun_createdAt_idx" ON "CronJobRun"("createdAt");
