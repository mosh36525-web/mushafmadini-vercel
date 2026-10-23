CREATE TABLE IF NOT EXISTS `auth_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(255) NOT NULL,
	`type` enum('VERIFICATION','RESET_PASSWORD') NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`used` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(64);
--> statement-breakpoint
SET @migration_sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'passwordHash'), 'SELECT 1', 'ALTER TABLE `users` ADD `passwordHash` varchar(255)');
--> statement-breakpoint
PREPARE migration_stmt FROM @migration_sql;
--> statement-breakpoint
EXECUTE migration_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE migration_stmt;
--> statement-breakpoint
SET @migration_sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'emailVerified'), 'SELECT 1', 'ALTER TABLE `users` ADD `emailVerified` boolean DEFAULT false NOT NULL');
--> statement-breakpoint
PREPARE migration_stmt FROM @migration_sql;
--> statement-breakpoint
EXECUTE migration_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE migration_stmt;
--> statement-breakpoint
SET @migration_sql = IF(EXISTS(SELECT index_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'users' AND non_unique = 0 GROUP BY index_name HAVING COUNT(*) = 1 AND MAX(column_name = 'email') = 1), 'SELECT 1', 'ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`)');
--> statement-breakpoint
PREPARE migration_stmt FROM @migration_sql;
--> statement-breakpoint
EXECUTE migration_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE migration_stmt;
--> statement-breakpoint
SET @migration_sql = IF(EXISTS(SELECT 1 FROM information_schema.key_column_usage WHERE constraint_schema = DATABASE() AND table_name = 'auth_tokens' AND constraint_name = 'auth_tokens_userId_users_id_fk') OR EXISTS(SELECT 1 FROM information_schema.key_column_usage WHERE constraint_schema = DATABASE() AND table_name = 'auth_tokens' AND column_name = 'userId' AND referenced_table_name = 'users' AND referenced_column_name = 'id'), 'SELECT 1', 'ALTER TABLE `auth_tokens` ADD CONSTRAINT `auth_tokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action');
--> statement-breakpoint
PREPARE migration_stmt FROM @migration_sql;
--> statement-breakpoint
EXECUTE migration_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE migration_stmt;
