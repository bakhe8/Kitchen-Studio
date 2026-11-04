CREATE TABLE `studio_job_events` (
	`project` text NOT NULL,
	`unit` text NOT NULL,
	`seq` integer NOT NULL,
	`receipt` text NOT NULL,
	`revision` integer NOT NULL,
	`request_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`actor` text NOT NULL,
	`actor_name` text NOT NULL,
	`action` text NOT NULL,
	`state` text NOT NULL,
	`payload` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`project`, `unit`, `seq`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_event_request` ON `studio_job_events` (`project`,`request_id`);--> statement-breakpoint
CREATE INDEX `job_event_receipt` ON `studio_job_events` (`project`,`receipt`);