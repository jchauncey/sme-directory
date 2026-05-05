-- AlterTable
ALTER TABLE "Group" ADD COLUMN "archivedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Group_archivedAt_idx" ON "Group"("archivedAt");
