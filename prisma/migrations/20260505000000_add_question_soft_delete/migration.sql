-- AlterTable
ALTER TABLE "Question" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Question_deletedAt_idx" ON "Question"("deletedAt");
