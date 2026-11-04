CREATE TABLE `studio_batches` (
	`project_id` text NOT NULL,
	`revision` integer NOT NULL,
	`design_key` text NOT NULL,
	`unit_ids` text NOT NULL,
	`issuer` text NOT NULL,
	`digest` text NOT NULL,
	`material_minor` integer NOT NULL,
	`issued` text NOT NULL,
	PRIMARY KEY(`project_id`, `revision`, `design_key`)
);
--> statement-breakpoint
CREATE INDEX `studio_batch_project` ON `studio_batches` (`project_id`);