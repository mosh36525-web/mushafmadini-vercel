SET @migration_sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'username'), 'SELECT 1', 'ALTER TABLE `users` ADD `username` varchar(32)');
--> statement-breakpoint
PREPARE migration_stmt FROM @migration_sql;
--> statement-breakpoint
EXECUTE migration_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE migration_stmt;
--> statement-breakpoint
SET @migration_sql = IF(EXISTS(SELECT index_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'users' AND non_unique = 0 GROUP BY index_name HAVING COUNT(*) = 1 AND MAX(column_name = 'username') = 1), 'SELECT 1', 'ALTER TABLE `users` ADD CONSTRAINT `users_username_unique` UNIQUE(`username`)');
--> statement-breakpoint
PREPARE migration_stmt FROM @migration_sql;
--> statement-breakpoint
EXECUTE migration_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE migration_stmt;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `recovery_codes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `codeHash` varchar(64) NOT NULL,
  `used` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `recovery_codes_id` PRIMARY KEY(`id`),
  CONSTRAINT `recovery_codes_codeHash_unique` UNIQUE(`codeHash`)
);
--> statement-breakpoint
SET @migration_sql = IF(EXISTS(SELECT index_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'recovery_codes' AND non_unique = 0 GROUP BY index_name HAVING COUNT(*) = 1 AND MAX(column_name = 'codeHash') = 1), 'SELECT 1', 'ALTER TABLE `recovery_codes` ADD CONSTRAINT `recovery_codes_codeHash_unique` UNIQUE(`codeHash`)');
--> statement-breakpoint
PREPARE migration_stmt FROM @migration_sql;
--> statement-breakpoint
EXECUTE migration_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE migration_stmt;
--> statement-breakpoint
SET @migration_sql = IF(EXISTS(SELECT 1 FROM information_schema.key_column_usage WHERE constraint_schema = DATABASE() AND table_name = 'recovery_codes' AND constraint_name = 'recovery_codes_userId_users_id_fk') OR EXISTS(SELECT 1 FROM information_schema.key_column_usage WHERE constraint_schema = DATABASE() AND table_name = 'recovery_codes' AND column_name = 'userId' AND referenced_table_name = 'users' AND referenced_column_name = 'id'), 'SELECT 1', 'ALTER TABLE `recovery_codes` ADD CONSTRAINT `recovery_codes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action');
--> statement-breakpoint
PREPARE migration_stmt FROM @migration_sql;
--> statement-breakpoint
EXECUTE migration_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE migration_stmt;
