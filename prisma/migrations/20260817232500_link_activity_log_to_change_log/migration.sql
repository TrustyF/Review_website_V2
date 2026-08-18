-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN "changeLogId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ActivityLog_changeLogId_key" ON "ActivityLog"("changeLogId");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_changeLogId_fkey" FOREIGN KEY ("changeLogId") REFERENCES "MediaChangeLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
