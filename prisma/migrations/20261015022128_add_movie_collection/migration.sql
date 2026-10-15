-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "collectionId" INTEGER;

-- CreateTable
CREATE TABLE "Collection" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameFr" TEXT,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Collection_externalId_key" ON "Collection"("externalId");

-- CreateIndex
CREATE INDEX "Movie_collectionId_idx" ON "Movie"("collectionId");

-- AddForeignKey
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
