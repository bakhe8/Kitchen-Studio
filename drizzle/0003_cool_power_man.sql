CREATE TABLE `studio_catalog_readers` (
	`catalog` text NOT NULL,
	`reader` text NOT NULL,
	PRIMARY KEY(`catalog`, `reader`)
);
--> statement-breakpoint
CREATE INDEX `studio_catalog_reader` ON `studio_catalog_readers` (`reader`);--> statement-breakpoint
CREATE TABLE `studio_catalog_versions` (
	`catalog` text NOT NULL,
	`version` integer NOT NULL,
	`request_id` text NOT NULL,
	`name` text NOT NULL,
	`digest` text NOT NULL,
	`object_key` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`catalog`, `version`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_catalog_request` ON `studio_catalog_versions` (`catalog`,`request_id`);--> statement-breakpoint
CREATE TABLE `studio_catalogs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `studio_catalog_owner` ON `studio_catalogs` (`owner`);