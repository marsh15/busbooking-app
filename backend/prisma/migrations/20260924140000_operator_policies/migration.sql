-- CreateTable
CREATE TABLE `Operator` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CancellationPolicy` (
    `id` VARCHAR(191) NOT NULL,
    `operatorId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `rules` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `CancellationPolicy_operatorId_version_key`(`operatorId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill: two clearly fictional operators with distinct threshold windows.
INSERT INTO `Operator` (`id`, `name`) VALUES
    ('f784cf17-c565-5c2d-bf40-53d92e8bbb52', 'Marigold Trail Travels'),
    ('bff47c1c-c0f5-5598-9e44-eba5fddad023', 'Peacock Roadways');

INSERT INTO `CancellationPolicy` (`id`, `operatorId`, `version`, `isActive`, `rules`) VALUES
    ('658b2b51-2dd9-56f9-a102-1f22a324bb44', 'f784cf17-c565-5c2d-bf40-53d92e8bbb52', 1, true,
     '[{"beforeDepartureHours": 72, "refundPercent": 90}, {"beforeDepartureHours": 24, "refundPercent": 70}, {"beforeDepartureHours": 6, "refundPercent": 40}]'),
    ('e33dcb60-c16a-546f-a115-51cf4116d7ea', 'bff47c1c-c0f5-5598-9e44-eba5fddad023', 1, true,
     '[{"beforeDepartureHours": 48, "refundPercent": 85}, {"beforeDepartureHours": 12, "refundPercent": 60}, {"beforeDepartureHours": 3, "refundPercent": 25}]');

-- Bus: move the operator string onto the Operator relation.
ALTER TABLE `Bus` ADD COLUMN `operatorId` VARCHAR(191) NULL;
UPDATE `Bus` SET `operatorId` = CASE `operator`
    WHEN 'Saffron Travels' THEN 'f784cf17-c565-5c2d-bf40-53d92e8bbb52'
    WHEN 'Deccan Mobility' THEN 'f784cf17-c565-5c2d-bf40-53d92e8bbb52'
    ELSE 'bff47c1c-c0f5-5598-9e44-eba5fddad023'
END;
ALTER TABLE `Bus` MODIFY `operatorId` VARCHAR(191) NOT NULL;
ALTER TABLE `Bus` DROP COLUMN `operator`;

-- Trip: point at the operator's active policy version; the flat cutoff/fee
-- columns are replaced by the versioned threshold rules.
ALTER TABLE `Trip` ADD COLUMN `policyId` VARCHAR(191) NULL;
UPDATE `Trip`
JOIN `Bus` ON `Bus`.`id` = `Trip`.`busId`
SET `Trip`.`policyId` = (
    SELECT `p`.`id` FROM `CancellationPolicy` `p`
    WHERE `p`.`operatorId` = `Bus`.`operatorId`
    ORDER BY `p`.`version` DESC LIMIT 1
);
ALTER TABLE `Trip` MODIFY `policyId` VARCHAR(191) NOT NULL;
ALTER TABLE `Trip` DROP COLUMN `cancellationCutoffMinutes`;
ALTER TABLE `Trip` DROP COLUMN `cancellationFeePercent`;

-- BookingGroup: immutable copy of the policy terms used at checkout.
ALTER TABLE `BookingGroup` ADD COLUMN `policySnapshot` JSON NULL;

-- CreateIndex
CREATE INDEX `Bus_operatorId_idx` ON `Bus`(`operatorId`);
CREATE INDEX `Trip_policyId_idx` ON `Trip`(`policyId`);

-- AddForeignKey
ALTER TABLE `Bus` ADD CONSTRAINT `Bus_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `Operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `CancellationPolicy` ADD CONSTRAINT `CancellationPolicy_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `Operator`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Trip` ADD CONSTRAINT `Trip_policyId_fkey` FOREIGN KEY (`policyId`) REFERENCES `CancellationPolicy`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
