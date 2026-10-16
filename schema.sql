-- ===================================================================
-- EXPOSED PROPAGANDUS - Official MySQL Database Schema
-- File: upload.sql
-- Target Database: if0_37976074_epsite
-- Host: sql200.infinityfree.com (or local MySQL / phpMyAdmin import)
-- Bharat Mata ki Jai 🇮🇳
-- ===================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+05:30";

-- -------------------------------------------------------------
-- Table: entities (Tracked Propagandus Profiles)
-- Zero pre-written entries: clean table ready for user submissions
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `entities`;
CREATE TABLE `entities` (
  `id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `handle_x` VARCHAR(100) DEFAULT NULL,
  `handle_yt` VARCHAR(100) DEFAULT NULL,
  `handle_insta` VARCHAR(100) DEFAULT NULL,
  `contact_phone` VARCHAR(50) DEFAULT NULL,
  `contact_email` VARCHAR(255) DEFAULT NULL,
  `other_links` TEXT DEFAULT NULL,
  `avatar_url` TEXT DEFAULT NULL,
  `categories` TEXT NOT NULL,
  `party` VARCHAR(255) DEFAULT NULL,
  `institution` VARCHAR(255) DEFAULT NULL,
  `narrative` TEXT NOT NULL,
  `fact_check` TEXT DEFAULT NULL,
  `proof_url` TEXT DEFAULT NULL,
  `upvotes` INT NOT NULL DEFAULT 0,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 1,
  `submitted_by_ip` VARCHAR(64) DEFAULT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_entities_upvotes` (`upvotes`),
  INDEX `idx_entities_party` (`party`),
  INDEX `idx_entities_institution` (`institution`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: nationalist_influencers (Nationalist Creators Directory)
-- Zero pre-written entries: clean table ready for suggestions & admin
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `nationalist_influencers`;
CREATE TABLE `nationalist_influencers` (
  `id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `handle_x` VARCHAR(100) DEFAULT NULL,
  `handle_yt` VARCHAR(100) DEFAULT NULL,
  `handle_insta` VARCHAR(100) DEFAULT NULL,
  `other_links` TEXT DEFAULT NULL,
  `avatar_url` TEXT DEFAULT NULL,
  `category` VARCHAR(150) DEFAULT 'Nationalist Creator',
  `categories` TEXT DEFAULT NULL,
  `description` TEXT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  `upvotes` INT NOT NULL DEFAULT 0,
  `suggested_by_ip` VARCHAR(64) DEFAULT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_nat_status` (`status`),
  INDEX `idx_nat_upvotes` (`upvotes`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: reports (⚠️ Public Reports sent to Admin Panel)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `reports`;
CREATE TABLE `reports` (
  `id` VARCHAR(100) NOT NULL,
  `entity_id` VARCHAR(100) NOT NULL,
  `entity_name` VARCHAR(255) DEFAULT NULL,
  `report_type` VARCHAR(100) NOT NULL,
  `message` TEXT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `reported_by_ip` VARCHAR(64) DEFAULT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_reports_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: blocked_ips (Security Banned IP List)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `blocked_ips`;
CREATE TABLE `blocked_ips` (
  `ip` VARCHAR(64) NOT NULL,
  `reason` TEXT DEFAULT NULL,
  `blocked_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: blocked_attempts (Hostile Blacklist Attempts on National Figures)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `blocked_attempts`;
CREATE TABLE `blocked_attempts` (
  `id` VARCHAR(100) NOT NULL,
  `ip` VARCHAR(64) NOT NULL,
  `attempted_name` VARCHAR(255) NOT NULL,
  `details` TEXT DEFAULT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: activity_logs (Audit Trail & Security Logging)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `activity_logs`;
CREATE TABLE `activity_logs` (
  `id` VARCHAR(100) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `details` TEXT DEFAULT NULL,
  `ip` VARCHAR(64) DEFAULT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: announcements (Admin Live Broadcast to Visitors)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `announcements`;
CREATE TABLE `announcements` (
  `id` VARCHAR(50) NOT NULL,
  `title` VARCHAR(255) DEFAULT 'उद्घोषणा / ANNOUNCEMENT',
  `message` TEXT NOT NULL,
  `type` VARCHAR(50) DEFAULT 'warning',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` VARCHAR(64) NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: govt_polls (Viksit Bharat Citizen Pulse Poll)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `govt_polls`;
CREATE TABLE `govt_polls` (
  `id` VARCHAR(50) NOT NULL,
  `question` TEXT NOT NULL,
  `yes_votes` INT NOT NULL DEFAULT 0,
  `no_votes` INT NOT NULL DEFAULT 0,
  `updated_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `govt_polls` (`id`, `question`, `yes_votes`, `no_votes`, `updated_at`)
VALUES ('bjp_2029', 'Will Bharat Achieve a $7 Trillion Economy by 2030 Under Nationalist Leadership?', 0, 0, '2026-10-14T00:00:00.000Z')
ON DUPLICATE KEY UPDATE `updated_at` = VALUES(`updated_at`);

-- -------------------------------------------------------------
-- Table: govt_poll_votes (1 Vote per IP Enforcement)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `govt_poll_votes`;
CREATE TABLE `govt_poll_votes` (
  `poll_id` VARCHAR(50) NOT NULL,
  `ip` VARCHAR(64) NOT NULL,
  `choice` VARCHAR(10) NOT NULL,
  `voted_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`poll_id`, `ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: system_settings (Spotlight Media & System Configuration)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `system_settings`;
CREATE TABLE `system_settings` (
  `key` VARCHAR(100) NOT NULL,
  `value` LONGTEXT NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `system_settings` (`key`, `value`, `updated_at`)
VALUES 
  ('spotlight_media', '{"type":"off","title":"","videoUrl":"","channelName":"","channelUrl":"","imageUrl":"","imageCaption":""}', '2026-10-14T00:00:00.000Z'),
  ('nationalist_bulletin', '{"is_active":1,"title":"⚡ RASHTRIYA FLASH BULLETIN","message":"Patriotic Alert: Counter anti-national propaganda on social media with verified facts, civilizational unity, and unwavering national resolve. Bharat Mata ki Jai! 🇮🇳","link":""}', '2026-10-14T00:00:00.000Z')
ON DUPLICATE KEY UPDATE `value` = VALUES(`value`);
-- -------------------------------------------------------------
-- Table: admin_users (Database Stored Admin Credentials)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `admin_users`;
CREATE TABLE `admin_users` (
  `id` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_admin_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `admin_users` (`id`, `email`, `password_hash`, `created_at`, `updated_at`)
VALUES ('admin-primary', 'omkumar.working@gmail.com', 'Q0gng04bk3', '2026-10-14T00:00:00.000Z', '2026-10-14T00:00:00.000Z')
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`), `password_hash` = VALUES(`password_hash`);

-- -------------------------------------------------------------
-- Table: playlist_tracks (Nationalist Audio & Music Player Tracks)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `playlist_tracks`;
CREATE TABLE `playlist_tracks` (
  `id` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `video_id` VARCHAR(64) NOT NULL,
  `author` VARCHAR(255) DEFAULT NULL,
  `thumbnail_url` TEXT DEFAULT NULL,
  `duration` VARCHAR(50) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `playlist_tracks` (`id`, `title`, `video_id`, `author`, `thumbnail_url`, `duration`, `is_active`, `sort_order`, `created_at`)
VALUES 
('track-1', 'Aarambh Hai Prachand (आरंभ है प्रचंड)', 'gg1tN-gkcwk', 'Piyush Mishra', 'https://i.ytimg.com/vi/gg1tN-gkcwk/hqdefault.jpg', '4:46', 1, 1, '2026-10-14T00:00:00.000Z'),
('track-2', 'Teri Mitti - Kesari | Akshay Kumar', 'wF_B_aagLfI', 'B Praak', 'https://i.ytimg.com/vi/wF_B_aagLfI/hqdefault.jpg', '5:14', 1, 2, '2026-10-14T00:00:00.000Z'),
('track-3', 'Maa Tujhe Salaam - Vande Mataram', 'jDn2bn7_YSM', 'A.R. Rahman', 'https://i.ytimg.com/vi/jDn2bn7_YSM/hqdefault.jpg', '6:12', 1, 3, '2026-10-14T00:00:00.000Z')
ON DUPLICATE KEY UPDATE `is_active` = VALUES(`is_active`);

-- -------------------------------------------------------------
-- Table: site_visitors (Realtime Live Visitor & Device Intel)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `site_visitors`;
CREATE TABLE `site_visitors` (
  `ip` VARCHAR(64) NOT NULL,
  `device_type` VARCHAR(50) DEFAULT 'Desktop',
  `os` VARCHAR(100) DEFAULT 'Unknown OS',
  `browser` VARCHAR(100) DEFAULT 'Unknown Browser',
  `user_agent` TEXT DEFAULT NULL,
  `visit_count` INT NOT NULL DEFAULT 1,
  `current_page` VARCHAR(120) DEFAULT 'Homepage',
  `first_visited` VARCHAR(64) NOT NULL,
  `last_seen` VARCHAR(64) NOT NULL,
  `is_blocked` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`ip`),
  KEY `idx_last_seen` (`last_seen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: visitor_traffic_logs (Historical Access Logs)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `visitor_traffic_logs`;
CREATE TABLE `visitor_traffic_logs` (
  `id` VARCHAR(100) NOT NULL,
  `ip` VARCHAR(64) NOT NULL,
  `device_type` VARCHAR(50) DEFAULT NULL,
  `os` VARCHAR(100) DEFAULT NULL,
  `browser` VARCHAR(100) DEFAULT NULL,
  `page` VARCHAR(120) DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ip` (`ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: profile_votes (Persistent Profile Upvote Deduplication by IP)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `profile_votes`;
CREATE TABLE `profile_votes` (
  `id` VARCHAR(100) NOT NULL,
  `target_id` VARCHAR(100) NOT NULL,
  `target_type` VARCHAR(50) NOT NULL,
  `ip` VARCHAR(64) NOT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_target_ip` (`target_id`, `ip`),
  KEY `idx_ip` (`ip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: site_categories (Dynamic Categories for Nationalist & Propagandist)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `site_categories`;
CREATE TABLE `site_categories` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_type_name` (`type`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `site_categories` (`type`, `name`, `created_at`) VALUES
('nationalist', 'Defence', '2026-10-14T00:00:00.000Z'),
('nationalist', 'Geopolitics', '2026-10-14T00:00:00.000Z'),
('nationalist', 'Supporter', '2026-10-14T00:00:00.000Z'),
('nationalist', 'Journalist', '2026-10-14T00:00:00.000Z'),
('nationalist', 'Media', '2026-10-14T00:00:00.000Z'),
('nationalist', 'Solo Influencer', '2026-10-14T00:00:00.000Z'),
('nationalist', 'Sanatan Dharma', '2026-10-14T00:00:00.000Z'),
('nationalist', 'International', '2026-10-14T00:00:00.000Z'),
('propagandist', 'Social Media', '2026-10-14T00:00:00.000Z'),
('propagandist', 'Political Party', '2026-10-14T00:00:00.000Z'),
('propagandist', 'Institutions', '2026-10-14T00:00:00.000Z'),
('propagandist', 'Journalist', '2026-10-14T00:00:00.000Z'),
('propagandist', 'YouTuber', '2026-10-14T00:00:00.000Z'),
('propagandist', 'Academic', '2026-10-14T00:00:00.000Z'),
('propagandist', 'Media House', '2026-10-14T00:00:00.000Z'),
('propagandist', 'Foreign Entity', '2026-10-14T00:00:00.000Z'),
('propagandist', 'Bureaucrat', '2026-10-14T00:00:00.000Z'),
('propagandist', 'Activist', '2026-10-14T00:00:00.000Z'),
('propagandist', 'NGO / Think Tank', '2026-10-14T00:00:00.000Z')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- -------------------------------------------------------------
-- Table: admin_posts (Nationalist Dispatches & Breaking Alerts)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `admin_posts`;
CREATE TABLE `admin_posts` (
  `id` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `image_url` TEXT DEFAULT NULL,
  `badge` VARCHAR(100) DEFAULT 'DISPATCH',
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0,
  `likes` INT NOT NULL DEFAULT 0,
  `views` INT NOT NULL DEFAULT 0,
  `created_at` VARCHAR(64) NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: comparisons (NDA vs UPA Historical Tracker)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `comparisons`;
CREATE TABLE `comparisons` (
  `id` VARCHAR(50) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `upa_period` VARCHAR(100) DEFAULT '2004 - 2014 (UPA)',
  `upa_value` VARCHAR(255) NOT NULL,
  `upa_details` TEXT,
  `nda_period` VARCHAR(100) DEFAULT '2014 - Present (NDA)',
  `nda_value` VARCHAR(255) NOT NULL,
  `nda_details` TEXT,
  `growth_badge` VARCHAR(100) DEFAULT NULL,
  `source` VARCHAR(255) DEFAULT NULL,
  `icon` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: community_users (Verified Patriotic Community Members)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `community_users`;
CREATE TABLE `community_users` (
  `id` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `avatar_url` TEXT DEFAULT NULL,
  `verified_type` VARCHAR(50) NOT NULL DEFAULT 'none', -- 'none', 'citizen', 'influencer'
  `ip_address` VARCHAR(64) DEFAULT NULL,
  `is_admin` TINYINT(1) NOT NULL DEFAULT 0,
  `is_banned` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` VARCHAR(64) NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_comm_username` (`username`),
  UNIQUE KEY `idx_comm_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed Master Admin Om Kumar in community_users
INSERT INTO `community_users` (`id`, `name`, `username`, `email`, `phone`, `password_hash`, `avatar_url`, `verified_type`, `is_admin`, `is_banned`, `created_at`, `updated_at`)
VALUES ('usr_admin', 'Om Kumar (Commander)', 'omkumar_admin', 'omkumar.working@gmail.com', '9876543210', 'Q0gng04bk3', 'https://api.dicebear.com/7.x/bottts/svg?seed=OmKumarAdmin', 'influencer', 1, 0, '2025-01-01 00:00:00', '2025-01-01 00:00:00');

-- -------------------------------------------------------------
-- Table: community_messages (Public & Private Channel Messages)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `community_messages`;
CREATE TABLE `community_messages` (
  `id` VARCHAR(100) NOT NULL,
  `channel_id` VARCHAR(100) NOT NULL DEFAULT 'public',
  `user_id` VARCHAR(100) NOT NULL,
  `user_name` VARCHAR(255) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `user_avatar` TEXT DEFAULT NULL,
  `verified_type` VARCHAR(50) NOT NULL DEFAULT 'none',
  `content` TEXT NOT NULL,
  `attachments` MEDIUMTEXT DEFAULT NULL,
  `media_links` TEXT DEFAULT NULL,
  `gif_url` TEXT DEFAULT NULL,
  `reactions` TEXT DEFAULT NULL,
  `reply_to` TEXT DEFAULT NULL,
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_comm_channel` (`channel_id`),
  INDEX `idx_comm_msg_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: community_channels (Google Meet Style Access Restricted Rooms)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `community_channels`;
CREATE TABLE `community_channels` (
  `id` VARCHAR(100) NOT NULL,
  `creator_id` VARCHAR(100) NOT NULL,
  `creator_name` VARCHAR(255) NOT NULL,
  `creator_username` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `join_token` VARCHAR(100) NOT NULL,
  `is_private` TINYINT(1) NOT NULL DEFAULT 1,
  `members` TEXT DEFAULT NULL,
  `pending_requests` TEXT DEFAULT NULL,
  `created_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_comm_join_token` (`join_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: community_notifications (@mention and Channel Alerts)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `community_notifications`;
CREATE TABLE `community_notifications` (
  `id` VARCHAR(100) NOT NULL,
  `recipient_username` VARCHAR(100) NOT NULL,
  `sender_username` VARCHAR(100) NOT NULL,
  `sender_name` VARCHAR(255) DEFAULT NULL,
  `message` TEXT NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_comm_notif_recipient` (`recipient_username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: community_contact_queries (User & Influencer Proof Submissions)
-- -------------------------------------------------------------
DROP TABLE IF EXISTS `community_contact_queries`;
CREATE TABLE `community_contact_queries` (
  `id` VARCHAR(100) NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'user',
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) DEFAULT NULL,
  `user_id` VARCHAR(100) DEFAULT NULL,
  `username` VARCHAR(100) DEFAULT NULL,
  `social_account_id` VARCHAR(255) DEFAULT NULL,
  `message` TEXT NOT NULL,
  `proof_file_name` VARCHAR(255) DEFAULT NULL,
  `proof_file` MEDIUMTEXT DEFAULT NULL,
  `ip` VARCHAR(64) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `created_at` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

