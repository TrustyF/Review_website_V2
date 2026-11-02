-- CreateEnum
CREATE TYPE "ListTier" AS ENUM ('S', 'A', 'B', 'C', 'D');

-- AlterTable
ALTER TABLE "ListItem" ADD COLUMN     "tier" "ListTier";
