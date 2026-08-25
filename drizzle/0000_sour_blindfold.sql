CREATE TABLE `scores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`callsign` text NOT NULL,
	`score` integer NOT NULL,
	`mode` text NOT NULL,
	`stage` integer DEFAULT -1 NOT NULL,
	`difficulty` text NOT NULL,
	`daily_key` text DEFAULT '' NOT NULL,
	`kills` integer DEFAULT 0 NOT NULL,
	`absorbed` integer DEFAULT 0 NOT NULL,
	`combo_x100` integer DEFAULT 100 NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "scores_callsign_length_check" CHECK(length("scores"."callsign") BETWEEN 1 AND 24),
	CONSTRAINT "scores_score_range_check" CHECK("scores"."score" BETWEEN 1 AND 100000000),
	CONSTRAINT "scores_stats_range_check" CHECK("scores"."kills" BETWEEN 0 AND 100000 AND "scores"."absorbed" BETWEEN 0 AND 100000 AND "scores"."combo_x100" BETWEEN 100 AND 100000 AND "scores"."duration_ms" BETWEEN 0 AND 3600000),
	CONSTRAINT "scores_scope_check" CHECK(("scores"."mode" = 'campaign' AND "scores"."stage" BETWEEN 0 AND 5 AND "scores"."daily_key" = '') OR ("scores"."mode" = 'daily' AND "scores"."stage" = -1 AND "scores"."difficulty" = 'standard' AND length("scores"."daily_key") = 10) OR ("scores"."mode" = 'arcade' AND "scores"."stage" = -1 AND "scores"."daily_key" = ''))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scores_user_scope_unique` ON `scores` (`user_id`,`mode`,`stage`,`difficulty`,`daily_key`);--> statement-breakpoint
CREATE INDEX `scores_leaderboard_idx` ON `scores` (`mode`,`stage`,`difficulty`,`daily_key`,`score`,`updated_at`);--> statement-breakpoint
PRAGMA optimize;
