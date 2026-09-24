-- AlterTable
ALTER TABLE `BookingGroup` ADD COLUMN `holdId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `PaymentAttempt` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `holdId` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'RECONCILIATION_REQUIRED') NOT NULL DEFAULT 'PENDING',
    `requestFingerprint` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'mock',
    `providerScenario` VARCHAR(191) NULL,
    `providerRef` VARCHAR(191) NOT NULL,
    `resultCode` VARCHAR(191) NULL,
    `bookingGroupId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PaymentAttempt_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `PaymentAttempt_holdId_idx`(`holdId`),
    UNIQUE INDEX `PaymentAttempt_userId_idempotencyKey_key`(`userId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `BookingGroup_holdId_key` ON `BookingGroup`(`holdId`);

-- AddForeignKey
ALTER TABLE `PaymentAttempt` ADD CONSTRAINT `PaymentAttempt_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentAttempt` ADD CONSTRAINT `PaymentAttempt_holdId_fkey` FOREIGN KEY (`holdId`) REFERENCES `SeatHold`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BookingGroup` ADD CONSTRAINT `BookingGroup_holdId_fkey` FOREIGN KEY (`holdId`) REFERENCES `SeatHold`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

