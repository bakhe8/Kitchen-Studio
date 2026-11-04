CREATE TABLE `studio_releases` (
	`project_id` text NOT NULL,
	`revision` integer NOT NULL,
	`issuer` text NOT NULL,
	`digest` text NOT NULL,
	`design_key` text NOT NULL,
	`total_minor` integer NOT NULL,
	`issued` text NOT NULL,
	PRIMARY KEY(`project_id`, `revision`)
);
