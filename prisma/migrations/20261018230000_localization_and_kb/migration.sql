-- AlterTable
ALTER TABLE `Workspace` ADD COLUMN `languages` JSON NULL,
    ADD COLUMN `uiStrings` JSON NULL;

-- AlterTable
ALTER TABLE `Guide` ADD COLUMN `translations` JSON NULL,
    ADD COLUMN `publishedTranslations` JSON NULL;

-- CreateTable
CREATE TABLE `KbCollection` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `translations` JSON NULL,
    `source` ENUM('MANUAL', 'ZENDESK', 'INTERCOM') NOT NULL DEFAULT 'MANUAL',
    `externalId` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KbCollection_workspaceId_position_idx`(`workspaceId`, `position`),
    UNIQUE INDEX `KbCollection_workspaceId_source_externalId_key`(`workspaceId`, `source`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KbArticle` (
    `id` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `collectionId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `title` VARCHAR(255) NOT NULL,
    `content` JSON NOT NULL,
    `translations` JSON NULL,
    `searchText` MEDIUMTEXT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `source` ENUM('MANUAL', 'ZENDESK', 'INTERCOM') NOT NULL DEFAULT 'MANUAL',
    `externalId` VARCHAR(64) NULL,
    `externalUrl` VARCHAR(1024) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KbArticle_workspaceId_status_idx`(`workspaceId`, `status`),
    INDEX `KbArticle_collectionId_idx`(`collectionId`),
    UNIQUE INDEX `KbArticle_workspaceId_source_externalId_key`(`workspaceId`, `source`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KbCollection` ADD CONSTRAINT `KbCollection_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KbArticle` ADD CONSTRAINT `KbArticle_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KbArticle` ADD CONSTRAINT `KbArticle_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `KbCollection`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
