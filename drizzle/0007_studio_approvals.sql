CREATE TABLE `studio_approvals` (
	`project_id` text NOT NULL,
	`revision` integer NOT NULL,
	`kind` text NOT NULL,
	`subject` text NOT NULL,
	`stamp_key` text NOT NULL,
	`stamp_name` text NOT NULL,
	`stamp_date` text NOT NULL,
	`detail` text NOT NULL,
	`actor` text NOT NULL,
	`actor_name` text NOT NULL,
	`recorded` text NOT NULL,
	PRIMARY KEY(`project_id`, `revision`, `kind`, `subject`)
);
