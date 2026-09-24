-- AlterTable
ALTER TABLE `Seat` ADD COLUMN `holdExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `holdId` VARCHAR(191) NULL,
    MODIFY `status` ENUM('AVAILABLE', 'HELD', 'BOOKED') NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE `User` ADD COLUMN `demoExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `isDemo` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `SeatHold` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tripId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'CONSUMED', 'RELEASED') NOT NULL DEFAULT 'ACTIVE',
    `fareSnapshot` DECIMAL(10, 2) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SeatHold_userId_status_idx`(`userId`, `status`),
    INDEX `SeatHold_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Seat_holdId_idx` ON `Seat`(`holdId`);

-- AddForeignKey
ALTER TABLE `Seat` ADD CONSTRAINT `Seat_holdId_fkey` FOREIGN KEY (`holdId`) REFERENCES `SeatHold`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeatHold` ADD CONSTRAINT `SeatHold_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SeatHold` ADD CONSTRAINT `SeatHold_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
