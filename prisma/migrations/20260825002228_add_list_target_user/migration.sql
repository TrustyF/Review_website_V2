-- AlterTable
ALTER TABLE "List" ADD COLUMN     "targetUserId" TEXT;

-- CreateIndex
CREATE INDEX "List_targetUserId_idx" ON "List"("targetUserId");

-- AddForeignKey
ALTER TABLE "List" ADD CONSTRAINT "List_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
