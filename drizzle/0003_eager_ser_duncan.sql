SET @migration_sql = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'sessionVersion'), 'SELECT 1', 'ALTER TABLE `users` ADD `sessionVersion` int DEFAULT 0 NOT NULL');
--> statement-breakpoint
PREPARE migration_stmt FROM @migration_sql;
--> statement-breakpoint
EXECUTE migration_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE migration_stmt;
--> statement-breakpoint
SET @migration_sql = IF(EXISTS(SELECT index_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'auth_tokens' AND non_unique = 0 GROUP BY index_name HAVING COUNT(*) = 1 AND MAX(column_name = 'tokenHash') = 1), 'SELECT 1', 'ALTER TABLE `auth_tokens` ADD CONSTRAINT `auth_tokens_tokenHash_unique` UNIQUE(`tokenHash`)');
--> statement-breakpoint
PREPARE migration_stmt FROM @migration_sql;
--> statement-breakpoint
EXECUTE migration_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE migration_stmt;
