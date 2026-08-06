CREATE TABLE `place_live_reports` (
  `id` VARCHAR(120) NOT NULL,
  `idempotency_key` VARCHAR(120) NOT NULL,
  `place_id` VARCHAR(80) NOT NULL,
  `bite_status` ENUM('no_bite', 'occasional', 'active') NOT NULL,
  `crowd_level` ENUM('quiet', 'normal', 'crowded') NOT NULL,
  `observed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `place_live_reports_idempotency_key_key`(`idempotency_key`),
  INDEX `place_live_reports_place_id_observed_at_idx`(`place_id`, `observed_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `place_live_reports_place_id_fkey` FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
