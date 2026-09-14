-- CreateEnum
CREATE TYPE "RecommendationRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'DISMISSED');

-- CreateTable
CREATE TABLE "RecommendationRequest" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "status" "RecommendationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "fulfilledListId" INTEGER,

    CONSTRAINT "RecommendationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationRequest_userId_status_idx" ON "RecommendationRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "RecommendationRequest_status_createdAt_idx" ON "RecommendationRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "RecommendationRequest" ADD CONSTRAINT "RecommendationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationRequest" ADD CONSTRAINT "RecommendationRequest_fulfilledListId_fkey" FOREIGN KEY ("fulfilledListId") REFERENCES "List"("id") ON DELETE SET NULL ON UPDATE CASCADE;
