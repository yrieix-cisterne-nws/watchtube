-- CreateTable
CREATE TABLE `videoview` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `videoId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `videoview_userId_videoId_key`(`userId`, `videoId`),
    INDEX `videoview_videoId_idx`(`videoId`),
    INDEX `videoview_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `videoview` ADD CONSTRAINT `videoview_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `videoview` ADD CONSTRAINT `videoview_videoId_fkey` FOREIGN KEY (`videoId`) REFERENCES `video`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
