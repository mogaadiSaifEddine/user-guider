-- AlterEnum
ALTER TYPE "KbSource" ADD VALUE 'USERGUIDING';

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "sourceUrl" VARCHAR(1024);

-- CreateIndex
CREATE INDEX "Asset_workspaceId_sourceUrl_idx" ON "Asset"("workspaceId", "sourceUrl");

