CREATE TABLE `studio_access` (
	`project_id` text NOT NULL,
	`member` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`project_id`, `member`)
);
--> statement-breakpoint
CREATE INDEX `studio_shared_member` ON `studio_access` (`member`);--> statement-breakpoint
CREATE TABLE `studio_members` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `studio_member_email` ON `studio_members` (`email`);--> statement-breakpoint
CREATE TABLE `studio_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `studio_project_owner` ON `studio_projects` (`owner`);--> statement-breakpoint
CREATE TABLE `studio_versions` (
	`project_id` text NOT NULL,
	`revision` integer NOT NULL,
	`request_id` text NOT NULL,
	`actor` text NOT NULL,
	`name` text NOT NULL,
	`digest` text NOT NULL,
	`bytes` integer NOT NULL,
	`updated` text NOT NULL,
	PRIMARY KEY(`project_id`, `revision`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_save_request` ON `studio_versions` (`project_id`,`request_id`);