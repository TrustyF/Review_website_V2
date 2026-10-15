-- AlterTable
ALTER TABLE "TvShow" ADD COLUMN     "originalLanguage" TEXT;

-- CreateTable
CREATE TABLE "Keyword" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaKeyword" (
    "mediaId" INTEGER NOT NULL,
    "keywordId" INTEGER NOT NULL,

    CONSTRAINT "MediaKeyword_pkey" PRIMARY KEY ("mediaId","keywordId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_externalId_key" ON "Keyword"("externalId");

-- CreateIndex
CREATE INDEX "MediaKeyword_keywordId_idx" ON "MediaKeyword"("keywordId");

-- AddForeignKey
ALTER TABLE "MediaKeyword" ADD CONSTRAINT "MediaKeyword_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaKeyword" ADD CONSTRAINT "MediaKeyword_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;
