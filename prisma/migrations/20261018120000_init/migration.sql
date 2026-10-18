-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'EDITOR');

-- CreateEnum
CREATE TYPE "GuideType" AS ENUM ('TOUR', 'CHECKLIST', 'ANNOUNCEMENT', 'HOTSPOT', 'SURVEY', 'RESOURCE_CENTER');

-- CreateEnum
CREATE TYPE "GuideStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KbSource" AS ENUM ('MANUAL', 'ZENDESK', 'INTERCOM');

-- CreateEnum
CREATE TYPE "KbStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('STARTED', 'COMPLETED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "secretKey" TEXT NOT NULL,
    "requireIdentityVerification" BOOLEAN NOT NULL DEFAULT false,
    "theme" JSONB NOT NULL,
    "aiContext" TEXT,
    "companyIdAttribute" VARCHAR(100),
    "companyNameAttribute" VARCHAR(100),
    "languages" JSONB,
    "uiStrings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("userId","workspaceId")
);

-- CreateTable
CREATE TABLE "Guide" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "GuideType" NOT NULL,
    "status" "GuideStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "publishedContent" JSONB,
    "translations" JSONB,
    "publishedTranslations" JSONB,
    "targeting" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbCollection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "translations" JSONB,
    "source" "KbSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KbArticle" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "collectionId" TEXT,
    "status" "KbStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(255) NOT NULL,
    "content" JSONB NOT NULL,
    "translations" JSONB,
    "searchText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "source" "KbSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" VARCHAR(64),
    "externalUrl" VARCHAR(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KbArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EndUser" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "externalId" VARCHAR(191) NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "attributes" JSONB NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" VARCHAR(191),
    "companyName" VARCHAR(191),
    "browser" VARCHAR(40),
    "os" VARCHAR(40),
    "device" VARCHAR(20),
    "language" VARCHAR(35),
    "timezone" VARCHAR(64),

    CONSTRAINT "EndUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivity" (
    "endUserId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("endUserId","day")
);

-- CreateTable
CREATE TABLE "SurveyAnswer" (
    "id" BIGSERIAL NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "endUserId" TEXT NOT NULL,
    "questionId" VARCHAR(64) NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuideProgress" (
    "endUserId" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'STARTED',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "completedItems" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideProgress_pkey" PRIMARY KEY ("endUserId","guideId")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" BIGSERIAL NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "endUserId" TEXT NOT NULL,
    "guideId" TEXT,
    "type" VARCHAR(64) NOT NULL,
    "name" VARCHAR(191),
    "stepIndex" INTEGER,
    "url" VARCHAR(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_publicKey_key" ON "Workspace"("publicKey");

-- CreateIndex
CREATE INDEX "Membership_workspaceId_idx" ON "Membership"("workspaceId");

-- CreateIndex
CREATE INDEX "Guide_workspaceId_status_idx" ON "Guide"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Asset_workspaceId_idx" ON "Asset"("workspaceId");

-- CreateIndex
CREATE INDEX "KbCollection_workspaceId_position_idx" ON "KbCollection"("workspaceId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "KbCollection_workspaceId_source_externalId_key" ON "KbCollection"("workspaceId", "source", "externalId");

-- CreateIndex
CREATE INDEX "KbArticle_workspaceId_status_idx" ON "KbArticle"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "KbArticle_collectionId_idx" ON "KbArticle"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "KbArticle_workspaceId_source_externalId_key" ON "KbArticle"("workspaceId", "source", "externalId");

-- CreateIndex
CREATE INDEX "EndUser_workspaceId_lastSeenAt_idx" ON "EndUser"("workspaceId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "EndUser_workspaceId_firstSeenAt_idx" ON "EndUser"("workspaceId", "firstSeenAt");

-- CreateIndex
CREATE INDEX "EndUser_workspaceId_companyId_idx" ON "EndUser"("workspaceId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "EndUser_workspaceId_externalId_key" ON "EndUser"("workspaceId", "externalId");

-- CreateIndex
CREATE INDEX "UserActivity_workspaceId_day_idx" ON "UserActivity"("workspaceId", "day");

-- CreateIndex
CREATE INDEX "SurveyAnswer_guideId_updatedAt_idx" ON "SurveyAnswer"("guideId", "updatedAt");

-- CreateIndex
CREATE INDEX "SurveyAnswer_workspaceId_idx" ON "SurveyAnswer"("workspaceId");

-- CreateIndex
CREATE INDEX "SurveyAnswer_endUserId_idx" ON "SurveyAnswer"("endUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyAnswer_guideId_endUserId_questionId_key" ON "SurveyAnswer"("guideId", "endUserId", "questionId");

-- CreateIndex
CREATE INDEX "GuideProgress_guideId_status_idx" ON "GuideProgress"("guideId", "status");

-- CreateIndex
CREATE INDEX "Event_workspaceId_createdAt_idx" ON "Event"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_guideId_type_createdAt_idx" ON "Event"("guideId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Event_endUserId_idx" ON "Event"("endUserId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guide" ADD CONSTRAINT "Guide_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbCollection" ADD CONSTRAINT "KbCollection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbArticle" ADD CONSTRAINT "KbArticle_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KbArticle" ADD CONSTRAINT "KbArticle_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "KbCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EndUser" ADD CONSTRAINT "EndUser_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_endUserId_fkey" FOREIGN KEY ("endUserId") REFERENCES "EndUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAnswer" ADD CONSTRAINT "SurveyAnswer_endUserId_fkey" FOREIGN KEY ("endUserId") REFERENCES "EndUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideProgress" ADD CONSTRAINT "GuideProgress_endUserId_fkey" FOREIGN KEY ("endUserId") REFERENCES "EndUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideProgress" ADD CONSTRAINT "GuideProgress_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_endUserId_fkey" FOREIGN KEY ("endUserId") REFERENCES "EndUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

