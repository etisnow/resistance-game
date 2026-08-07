import {index, integer, sqliteTable, text, uniqueIndex} from 'drizzle-orm/sqlite-core';

// Схема аналитического центра. Одна SQLite-база, ORM — drizzle.
//
// Принцип хранения: сырые события партии лежат как есть (events), а всё, что
// стоит дорого считать на лету, разложено по «широким» таблицам (marks,
// match_players). Агрегаты не материализуем — данных мало (узкая компания
// людей), SQL по индексам отвечает мгновенно, зато любая новая метрика
// считается по историческим партиям без пересборки.
//
// Ник — это личность. Каноничный ключ игрока (`players.key`) — ник в нижнем
// регистре без краевых пробелов; ровно так же игровой сервер узнаёт человека
// между подключениями. Слияние двух ников делает админка: она переписывает
// ключи в таблицах и оставляет запись в `aliases`, чтобы будущие партии
// приходили уже под каноничным ключом.

/** Партия целиком. Приезжает одним пакетом после окончания игры. */
export const matches = sqliteTable(
	'matches',
	{
		matchId: text('match_id').primaryKey(),
		seed: integer('seed').notNull(),
		/** live | bots | e2e | test — публичная витрина показывает только live. */
		source: text('source').notNull(),
		startedAt: integer('started_at').notNull(),
		endedAt: integer('ended_at').notNull(),
		durationMs: integer('duration_ms').notNull(),
		playerCount: integer('player_count').notNull(),
		turns: integer('turns').notNull(),
		/** thing | humans | null (партию бросили). */
		winner: text('winner'),
		endReason: text('end_reason').notNull(),
		endMessage: text('end_message').notNull(),
		isComplete: integer('is_complete').notNull(),
		hasBots: integer('has_bots').notNull(),
		/** Админ может убрать партию из публичной статистики, не удаляя её. */
		isHidden: integer('is_hidden').notNull().default(0),
		/** Игровой лог строками (JSON) — чтобы партию можно было перечитать. */
		gameLog: text('game_log').notNull().default('[]'),
		ingestedAt: integer('ingested_at').notNull(),
	},
	(table) => [
		index('matches_started_at_idx').on(table.startedAt),
		index('matches_source_idx').on(table.source),
	],
);

/** Человек за столом. Одна строка на ник за всю историю. */
export const players = sqliteTable(
	'players',
	{
		/** Каноничный ключ: ник в нижнем регистре. */
		key: text('key').primaryKey(),
		/** Как показывать ник (последнее написание). */
		displayName: text('display_name').notNull(),
		firstSeen: integer('first_seen').notNull(),
		lastSeen: integer('last_seen').notNull(),
		isBot: integer('is_bot').notNull().default(0),
		/** Спрятать игрока из публичной статистики. */
		isHidden: integer('is_hidden').notNull().default(0),
	},
	(table) => [index('players_last_seen_idx').on(table.lastSeen)],
);

/** Слитые ники: alias -> канон. Применяется на входе новых партий. */
export const aliases = sqliteTable('aliases', {
	aliasKey: text('alias_key').primaryKey(),
	canonicalKey: text('canonical_key').notNull(),
	createdAt: integer('created_at').notNull(),
});

/** Участие игрока в партии и её итог лично для него. */
export const matchPlayers = sqliteTable(
	'match_players',
	{
		id: integer('id').primaryKey({autoIncrement: true}),
		matchId: text('match_id').notNull(),
		playerKey: text('player_key').notNull(),
		nickname: text('nickname').notNull(),
		seat: integer('seat').notNull(),
		isBot: integer('is_bot').notNull(),
		isThing: integer('is_thing').notNull(),
		infectedAtEnd: integer('infected_at_end').notNull(),
		survived: integer('survived').notNull(),
		isWinner: integer('is_winner').notNull(),
		infectedAtTurn: integer('infected_at_turn'),
		/** thing | infected | human — роль на конец партии. */
		role: text('role').notNull(),
	},
	(table) => [
		uniqueIndex('match_players_unique').on(table.matchId, table.playerKey),
		index('match_players_player_idx').on(table.playerKey),
	],
);

/** Сырое событие партии. Всё, что произошло за столом, лежит здесь. */
export const events = sqliteTable(
	'events',
	{
		id: integer('id').primaryKey({autoIncrement: true}),
		matchId: text('match_id').notNull(),
		seq: integer('seq').notNull(),
		ts: integer('ts').notNull(),
		turn: integer('turn').notNull(),
		type: text('type').notNull(),
		actorKey: text('actor_key'),
		targetKey: text('target_key'),
		actor: text('actor'),
		target: text('target'),
		cardId: text('card_id'),
		actorRole: text('actor_role'),
		targetRole: text('target_role'),
		/** Остальные поля события — JSON. */
		detail: text('detail').notNull().default('{}'),
	},
	(table) => [
		uniqueIndex('events_unique').on(table.matchId, table.seq),
		index('events_type_idx').on(table.type),
		index('events_actor_idx').on(table.actorKey),
		index('events_target_idx').on(table.targetKey),
		index('events_card_idx').on(table.cardId),
	],
);

/**
 * Простановки статусов — отдельной таблицей, потому что это главный предмет
 * исследования: кто кого в чём подозревал и был ли прав.
 *
 * `isCorrect` считается на входе: сравниваем статус с тем, кем цель БЫЛА В ЭТОТ
 * МОМЕНТ (а не в конце партии) — иначе игрок, поставивший «чист» до заражения
 * цели, задним числом оказался бы неправ. `isFinal` помечает последний статус
 * этого игрока на эту цель — по нему считается «итоговое мнение».
 */
export const marks = sqliteTable(
	'marks',
	{
		id: integer('id').primaryKey({autoIncrement: true}),
		matchId: text('match_id').notNull(),
		eventSeq: integer('event_seq').notNull(),
		ts: integer('ts').notNull(),
		turn: integer('turn').notNull(),
		actorKey: text('actor_key').notNull(),
		targetKey: text('target_key').notNull(),
		actor: text('actor').notNull(),
		target: text('target').notNull(),
		/** clear | question | infected | thing | none */
		mark: text('mark').notNull(),
		previousMark: text('previous_mark'),
		targetWasThing: integer('target_was_thing').notNull(),
		targetWasInfected: integer('target_was_infected').notNull(),
		/** 1 | 0 | null (нейтральные статусы «?» и «снят» не оцениваются). */
		isCorrect: integer('is_correct'),
		isFinal: integer('is_final').notNull().default(0),
	},
	(table) => [
		uniqueIndex('marks_unique').on(table.matchId, table.eventSeq),
		index('marks_actor_idx').on(table.actorKey),
		index('marks_target_idx').on(table.targetKey),
		index('marks_match_idx').on(table.matchId),
	],
);

/** Настройки центра (ключ-значение): публичность ников, заголовок и т.п. */
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
});

export type TMatchRow = typeof matches.$inferSelect;
export type TPlayerRow = typeof players.$inferSelect;
export type TMatchPlayerRow = typeof matchPlayers.$inferSelect;
export type TEventRow = typeof events.$inferSelect;
export type TMarkRow = typeof marks.$inferSelect;
