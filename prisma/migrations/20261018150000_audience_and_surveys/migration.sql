-- AlterTable
ALTER TABLE `EndUser` ADD COLUMN `browser` VARCHAR(40) NULL,
    ADD COLUMN `companyId` VARCHAR(191) NULL,
    ADD COLUMN `companyName` VARCHAR(191) NULL,
    ADD COLUMN `device` VARCHAR(20) NULL,
    ADD COLUMN `language` VARCHAR(35) NULL,
    ADD COLUMN `os` VARCHAR(40) NULL,
    ADD COLUMN `timezone` VARCHAR(64) NULL;

-- AlterTable
ALTER TABLE `Guide` MODIFY `type` ENUM('TOUR', 'CHECKLIST', 'ANNOUNCEMENT', 'HOTSPOT', 'SURVEY') NOT NULL;

-- AlterTable
ALTER TABLE `Workspace` ADD COLUMN `companyIdAttribute` VARCHAR(100) NULL,
    ADD COLUMN `companyNameAttribute` VARCHAR(100) NULL;

-- CreateTable
CREATE TABLE `UserActivity` (
    `endUserId` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `day` DATE NOT NULL,

    INDEX `UserActivity_workspaceId_day_idx`(`workspaceId`, `day`),
    PRIMARY KEY (`endUserId`, `day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurveyAnswer` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `workspaceId` VARCHAR(191) NOT NULL,
    `guideId` VARCHAR(191) NOT NULL,
    `endUserId` VARCHAR(191) NOT NULL,
    `questionId` VARCHAR(64) NOT NULL,
    `value` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SurveyAnswer_guideId_updatedAt_idx`(`guideId`, `updatedAt`),
    INDEX `SurveyAnswer_workspaceId_idx`(`workspaceId`),
    INDEX `SurveyAnswer_endUserId_idx`(`endUserId`),
    UNIQUE INDEX `SurveyAnswer_guideId_endUserId_questionId_key`(`guideId`, `endUserId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `EndUser_workspaceId_firstSeenAt_idx` ON `EndUser`(`workspaceId`, `firstSeenAt`);

-- CreateIndex
CREATE INDEX `EndUser_workspaceId_companyId_idx` ON `EndUser`(`workspaceId`, `companyId`);

-- AddForeignKey
ALTER TABLE `UserActivity` ADD CONSTRAINT `UserActivity_endUserId_fkey` FOREIGN KEY (`endUserId`) REFERENCES `EndUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserActivity` ADD CONSTRAINT `UserActivity_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyAnswer` ADD CONSTRAINT `SurveyAnswer_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyAnswer` ADD CONSTRAINT `SurveyAnswer_guideId_fkey` FOREIGN KEY (`guideId`) REFERENCES `Guide`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurveyAnswer` ADD CONSTRAINT `SurveyAnswer_endUserId_fkey` FOREIGN KEY (`endUserId`) REFERENCES `EndUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: every day we already know a user was around.
INSERT IGNORE INTO `UserActivity` (`endUserId`, `workspaceId`, `day`)
  SELECT `id`, `workspaceId`, DATE(`firstSeenAt`) FROM `EndUser`
  UNION SELECT `id`, `workspaceId`, DATE(`lastSeenAt`) FROM `EndUser`
  UNION SELECT DISTINCT `endUserId`, `workspaceId`, DATE(`createdAt`) FROM `Event`;
