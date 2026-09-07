-- CreateTable
CREATE TABLE "WatchedItem" (
    "userId" TEXT NOT NULL,
    "mediaId" INTEGER NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchedItem_pkey" PRIMARY KEY ("userId","mediaId")
);

-- CreateIndex
CREATE INDEX "WatchedItem_mediaId_idx" ON "WatchedItem"("mediaId");

-- AddForeignKey
ALTER TABLE "WatchedItem" ADD CONSTRAINT "WatchedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchedItem" ADD CONSTRAINT "WatchedItem_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
