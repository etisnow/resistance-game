CREATE TABLE `aliases` (
	`alias_key` text PRIMARY KEY NOT NULL,
	`canonical_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` text NOT NULL,
	`seq` integer NOT NULL,
	`ts` integer NOT NULL,
	`turn` integer NOT NULL,
	`type` text NOT NULL,
	`actor_key` text,
	`target_key` text,
	`actor` text,
	`target` text,
	`card_id` text,
	`actor_role` text,
	`target_role` text,
	`detail` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_unique` ON `events` (`match_id`,`seq`);--> statement-breakpoint
CREATE INDEX `events_type_idx` ON `events` (`type`);--> statement-breakpoint
CREATE INDEX `events_actor_idx` ON `events` (`actor_key`);--> statement-breakpoint
CREATE INDEX `events_target_idx` ON `events` (`target_key`);--> statement-breakpoint
CREATE INDEX `events_card_idx` ON `events` (`card_id`);--> statement-breakpoint
CREATE TABLE `marks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` text NOT NULL,
	`event_seq` integer NOT NULL,
	`ts` integer NOT NULL,
	`turn` integer NOT NULL,
	`actor_key` text NOT NULL,
	`target_key` text NOT NULL,
	`actor` text NOT NULL,
	`target` text NOT NULL,
	`mark` text NOT NULL,
	`previous_mark` text,
	`target_was_thing` integer NOT NULL,
	`target_was_infected` integer NOT NULL,
	`is_correct` integer,
	`is_final` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `marks_unique` ON `marks` (`match_id`,`event_seq`);--> statement-breakpoint
CREATE INDEX `marks_actor_idx` ON `marks` (`actor_key`);--> statement-breakpoint
CREATE INDEX `marks_target_idx` ON `marks` (`target_key`);--> statement-breakpoint
CREATE INDEX `marks_match_idx` ON `marks` (`match_id`);--> statement-breakpoint
CREATE TABLE `match_players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` text NOT NULL,
	`player_key` text NOT NULL,
	`nickname` text NOT NULL,
	`seat` integer NOT NULL,
	`is_bot` integer NOT NULL,
	`is_thing` integer NOT NULL,
	`infected_at_end` integer NOT NULL,
	`survived` integer NOT NULL,
	`is_winner` integer NOT NULL,
	`infected_at_turn` integer,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `match_players_unique` ON `match_players` (`match_id`,`player_key`);--> statement-breakpoint
CREATE INDEX `match_players_player_idx` ON `match_players` (`player_key`);--> statement-breakpoint
CREATE TABLE `matches` (
	`match_id` text PRIMARY KEY NOT NULL,
	`seed` integer NOT NULL,
	`source` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`player_count` integer NOT NULL,
	`turns` integer NOT NULL,
	`winner` text,
	`end_reason` text NOT NULL,
	`end_message` text NOT NULL,
	`is_complete` integer NOT NULL,
	`has_bots` integer NOT NULL,
	`is_hidden` integer DEFAULT 0 NOT NULL,
	`game_log` text DEFAULT '[]' NOT NULL,
	`ingested_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `matches_started_at_idx` ON `matches` (`started_at`);--> statement-breakpoint
CREATE INDEX `matches_source_idx` ON `matches` (`source`);--> statement-breakpoint
CREATE TABLE `players` (
	`key` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`first_seen` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`is_bot` integer DEFAULT 0 NOT NULL,
	`is_hidden` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `players_last_seen_idx` ON `players` (`last_seen`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
