CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `User_email_key` (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `City` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `City_name_key` (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Route` (
  `id` VARCHAR(191) NOT NULL,
  `sourceId` VARCHAR(191) NOT NULL,
  `destinationId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Route_sourceId_destinationId_key` (`sourceId`, `destinationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Bus` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `operator` VARCHAR(191) NOT NULL,
  `type` ENUM('SLEEPER', 'SEATER') NOT NULL,
  `isAc` BOOLEAN NOT NULL,
  `amenities` JSON NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Trip` (
  `id` VARCHAR(191) NOT NULL,
  `routeId` VARCHAR(191) NOT NULL,
  `busId` VARCHAR(191) NOT NULL,
  `travelDate` DATETIME(3) NOT NULL,
  `departureTime` VARCHAR(191) NOT NULL,
  `arrivalTime` VARCHAR(191) NOT NULL,
  `durationMinutes` INTEGER NOT NULL,
  `isDemo` BOOLEAN NOT NULL DEFAULT false,
  `fare` DECIMAL(10,2) NOT NULL,
  `cancellationCutoffMinutes` INTEGER NOT NULL DEFAULT 360,
  `cancellationFeePercent` DECIMAL(5,2) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `Trip_routeId_travelDate_idx` (`routeId`, `travelDate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Seat` (
  `id` VARCHAR(191) NOT NULL,
  `tripId` VARCHAR(191) NOT NULL,
  `seatNumber` VARCHAR(191) NOT NULL,
  `deck` INTEGER NOT NULL,
  `row` INTEGER NOT NULL,
  `column` INTEGER NOT NULL,
  `status` ENUM('AVAILABLE', 'BOOKED') NOT NULL DEFAULT 'AVAILABLE',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Seat_tripId_seatNumber_key` (`tripId`, `seatNumber`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BookingGroup` (
  `id` VARCHAR(191) NOT NULL,
  `pnr` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `status` ENUM('ACTIVE', 'PARTIALLY_CANCELLED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BookingGroup_pnr_key` (`pnr`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Booking` (
  `id` VARCHAR(191) NOT NULL,
  `groupId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `tripId` VARCHAR(191) NOT NULL,
  `seatId` VARCHAR(191) NOT NULL,
  `seatNumber` VARCHAR(191) NOT NULL,
  `passengerName` VARCHAR(191) NOT NULL,
  `passengerAge` INTEGER NOT NULL,
  `totalFare` DECIMAL(10,2) NOT NULL,
  `status` ENUM('ACTIVE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  `cancelledAt` DATETIME(3) NULL,
  `refundAmount` DECIMAL(10,2) NULL,
  PRIMARY KEY (`id`),
  INDEX `Booking_userId_status_idx` (`userId`, `status`),
  INDEX `Booking_groupId_idx` (`groupId`),
  INDEX `Booking_tripId_seatId_idx` (`tripId`, `seatId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Route` ADD CONSTRAINT `Route_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `City`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Route` ADD CONSTRAINT `Route_destinationId_fkey` FOREIGN KEY (`destinationId`) REFERENCES `City`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Trip` ADD CONSTRAINT `Trip_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `Route`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Trip` ADD CONSTRAINT `Trip_busId_fkey` FOREIGN KEY (`busId`) REFERENCES `Bus`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Seat` ADD CONSTRAINT `Seat_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `BookingGroup` ADD CONSTRAINT `BookingGroup_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `BookingGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Booking` ADD CONSTRAINT `Booking_seatId_fkey` FOREIGN KEY (`seatId`) REFERENCES `Seat`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
