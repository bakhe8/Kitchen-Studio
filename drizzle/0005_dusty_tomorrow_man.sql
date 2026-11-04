CREATE TABLE `studio_stock_events` (
	`catalog` text NOT NULL,
	`request` text NOT NULL,
	`kind` text NOT NULL,
	`fingerprint` text NOT NULL,
	`reservation` text NOT NULL,
	`project` text NOT NULL,
	`revision` integer NOT NULL,
	`scope` text NOT NULL,
	`units` text NOT NULL,
	`lines` text NOT NULL,
	`note` text NOT NULL,
	`actor` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`catalog`, `request`)
);
--> statement-breakpoint
CREATE INDEX `studio_stock_reservation` ON `studio_stock_events` (`catalog`,`reservation`,`kind`);--> statement-breakpoint
ALTER TABLE `studio_releases` ADD `scope_json` text;