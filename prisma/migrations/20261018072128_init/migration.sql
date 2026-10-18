-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Workspace` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `publicKey` VARCHAR(191) NOT NULL,
    `secretKey` VARCHAR(191) NOT NULL,
    `requireIdentityVerification` BOOLEAN NOT NULL DEFAULT false,
    `theme` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Workspace_publicKey_key`(`publicKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Membership` (
    `userId` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'EDITOR') NOT NULL DEFAULT 'EDITOR',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Membership_workspaceId_idx`(`workspaceId`),
    PRIMARY KEY (`userId`, `workspaceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Guide` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('TOUR', 'CHECKLIST', 'ANNOUNCEMENT', 'HOTSPOT') NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `content` JSON NOT NULL,
    `publishedContent` JSON NULL,
    `targeting` JSON NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Guide_workspaceId_status_idx`(`workspaceId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EndUser` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `anonymous` BOOLEAN NOT NULL DEFAULT false,
    `attributes` JSON NOT NULL,
    `firstSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EndUser_workspaceId_lastSeenAt_idx`(`workspaceId`, `lastSeenAt`),
    UNIQUE INDEX `EndUser_workspaceId_externalId_key`(`workspaceId`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuideProgress` (
    `endUserId` VARCHAR(191) NOT NULL,
    `guideId` VARCHAR(191) NOT NULL,
    `status` ENUM('STARTED', 'COMPLETED', 'DISMISSED') NOT NULL DEFAULT 'STARTED',
    `currentStep` INTEGER NOT NULL DEFAULT 0,
    `completedItems` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GuideProgress_guideId_status_idx`(`guideId`, `status`),
    PRIMARY KEY (`endUserId`, `guideId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `workspaceId` VARCHAR(191) NOT NULL,
    `endUserId` VARCHAR(191) NOT NULL,
    `guideId` VARCHAR(191) NULL,
    `type` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NULL,
    `stepIndex` INTEGER NULL,
    `url` VARCHAR(1024) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Event_workspaceId_createdAt_idx`(`workspaceId`, `createdAt`),
    INDEX `Event_guideId_type_createdAt_idx`(`guideId`, `type`, `createdAt`),
    INDEX `Event_endUserId_idx`(`endUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Membership` ADD CONSTRAINT `Membership_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guide` ADD CONSTRAINT `Guide_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EndUser` ADD CONSTRAINT `EndUser_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuideProgress` ADD CONSTRAINT `GuideProgress_endUserId_fkey` FOREIGN KEY (`endUserId`) REFERENCES `EndUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuideProgress` ADD CONSTRAINT `GuideProgress_guideId_fkey` FOREIGN KEY (`guideId`) REFERENCES `Guide`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_endUserId_fkey` FOREIGN KEY (`endUserId`) REFERENCES `EndUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Event` ADD CONSTRAINT `Event_guideId_fkey` FOREIGN KEY (`guideId`) REFERENCES `Guide`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
