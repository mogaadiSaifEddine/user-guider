-- CreateEnum
CREATE TYPE "UpdateStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "updatesPage" JSONB,
ADD COLUMN     "updatesSlug" VARCHAR(64);

-- CreateTable
CREATE TABLE "ProductUpdate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" JSONB NOT NULL,
    "translations" JSONB,
    "coverUrl" VARCHAR(1000),
    "labels" JSONB NOT NULL,
    "status" "UpdateStatus" NOT NULL DEFAULT 'DRAFT',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductUpdateReaction" (
    "updateId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "visitor" VARCHAR(200) NOT NULL,
    "reaction" VARCHAR(16) NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUpdateReaction_pkey" PRIMARY KEY ("updateId","visitor")
);

-- CreateIndex
CREATE INDEX "ProductUpdate_workspaceId_status_publishedAt_idx" ON "ProductUpdate"("workspaceId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "ProductUpdateReaction_workspaceId_idx" ON "ProductUpdateReaction"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_updatesSlug_key" ON "Workspace"("updatesSlug");

-- AddForeignKey
ALTER TABLE "ProductUpdate" ADD CONSTRAINT "ProductUpdate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUpdateReaction" ADD CONSTRAINT "ProductUpdateReaction_updateId_fkey" FOREIGN KEY ("updateId") REFERENCES "ProductUpdate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUpdateReaction" ADD CONSTRAINT "ProductUpdateReaction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

