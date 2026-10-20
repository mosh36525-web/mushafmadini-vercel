CREATE TABLE `user_data` (
	`userId` int NOT NULL,
	`data` json NOT NULL,
	`updatedAt` datetime(3) NOT NULL,
	CONSTRAINT `user_data_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `user_data` ADD CONSTRAINT `user_data_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;