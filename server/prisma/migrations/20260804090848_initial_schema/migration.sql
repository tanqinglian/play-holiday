-- CreateTable
CREATE TABLE `places` (
    `id` VARCHAR(80) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `district` VARCHAR(80) NOT NULL,
    `address` VARCHAR(500) NOT NULL,
    `category` ENUM('wild_spot', 'fishery', 'water_body', 'tackle_shop', 'private_spot') NOT NULL,
    `fee_type` ENUM('free', 'paid', 'unknown') NOT NULL,
    `fee_text` VARCHAR(300) NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `coordinate_status` ENUM('missing', 'source_provided', 'geocoded', 'user_confirmed') NOT NULL,
    `location_precision` ENUM('public_exact', 'public_coarse', 'private_exact') NOT NULL,
    `detail_available` BOOLEAN NOT NULL DEFAULT true,
    `visibility` ENUM('visible', 'hidden', 'removed') NOT NULL DEFAULT 'visible',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `places_visibility_district_idx`(`visibility`, `district`),
    INDEX `places_latitude_longitude_idx`(`latitude`, `longitude`),
    INDEX `places_fee_type_category_idx`(`fee_type`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `place_sources` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `place_id` VARCHAR(80) NOT NULL,
    `platform` VARCHAR(50) NOT NULL,
    `source_record_id` VARCHAR(100) NOT NULL,
    `source_url` VARCHAR(1000) NOT NULL,
    `captured_at` DATETIME(3) NOT NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,

    INDEX `place_sources_place_id_idx`(`place_id`),
    UNIQUE INDEX `place_sources_platform_source_record_id_key`(`platform`, `source_record_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `place_comments` (
    `id` VARCHAR(120) NOT NULL,
    `place_id` VARCHAR(80) NOT NULL,
    `text` TEXT NOT NULL,
    `rating` DOUBLE NULL,
    `published_label` VARCHAR(80) NOT NULL,
    `content_type` ENUM('external_historical', 'user_submission') NOT NULL,
    `source_platform` VARCHAR(50) NOT NULL,
    `source_captured_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `place_comments_place_id_content_type_idx`(`place_id`, `content_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `place_images` (
    `id` VARCHAR(120) NOT NULL,
    `place_id` VARCHAR(80) NOT NULL,
    `source_url` VARCHAR(1000) NOT NULL,
    `local_path` VARCHAR(1000) NULL,
    `thumbnail_url` VARCHAR(1000) NULL,
    `bytes` INTEGER NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_visible` BOOLEAN NOT NULL DEFAULT true,

    INDEX `place_images_place_id_sort_order_idx`(`place_id`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `place_tags` (
    `place_id` VARCHAR(80) NOT NULL,
    `category` ENUM('scene', 'fee', 'method', 'species', 'status') NOT NULL,
    `value` VARCHAR(100) NOT NULL,

    INDEX `place_tags_category_value_idx`(`category`, `value`),
    PRIMARY KEY (`place_id`, `category`, `value`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `place_update_submissions` (
    `id` VARCHAR(120) NOT NULL,
    `place_id` VARCHAR(80) NOT NULL,
    `field` VARCHAR(80) NOT NULL,
    `value` TEXT NOT NULL,
    `note` TEXT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewed_at` DATETIME(3) NULL,

    INDEX `place_update_submissions_place_id_status_created_at_idx`(`place_id`, `status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `place_sources` ADD CONSTRAINT `place_sources_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `place_comments` ADD CONSTRAINT `place_comments_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `place_images` ADD CONSTRAINT `place_images_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `place_tags` ADD CONSTRAINT `place_tags_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `place_update_submissions` ADD CONSTRAINT `place_update_submissions_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
