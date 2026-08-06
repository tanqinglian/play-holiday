CREATE TABLE `image_assets` (
    `id` VARCHAR(120) NOT NULL,
    `owner_type` ENUM('place', 'trip') NOT NULL,
    `owner_id` VARCHAR(120) NOT NULL,
    `mime_type` VARCHAR(50) NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `byte_size` INTEGER NOT NULL,
    `thumbnail_byte_size` INTEGER NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `data` LONGBLOB NOT NULL,
    `thumbnail_data` LONGBLOB NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `image_assets_owner_type_owner_id_created_at_idx`(`owner_type`, `owner_id`, `created_at`),
    INDEX `image_assets_sha256_idx`(`sha256`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
