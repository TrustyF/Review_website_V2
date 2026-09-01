-- DropForeignKey
ALTER TABLE "List" DROP CONSTRAINT "List_targetUserId_fkey";

-- AddForeignKey
ALTER TABLE "List" ADD CONSTRAINT "List_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
