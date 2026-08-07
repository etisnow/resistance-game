import {and, asc, eq, sql} from 'drizzle-orm';
import {statSync} from 'fs';
import {aliases, events, marks, matchPlayers, matches, players, settings} from 'analytics/db/schema';
import {nicknameKey} from 'analytics/db/nicknames';
import {buildMarkRows, type IMarkInput} from 'analytics/db/markRows';
import {EAnalyticsEvent} from 'shared/analytics/contract';
import {getSourceCounts} from 'analytics/server/queries/matches';
import type {TDb} from 'analytics/db/client';
import type {IAdminStats} from 'analytics/shared/api';

/** Служебные счётчики базы. */
export const getAdminStats = (db: TDb, dbPath: string): IAdminStats => {
	const one = (query: {get: () => {value: number} | undefined}) => query.get()?.value ?? 0;
	return {
		dbPath,
		dbSizeBytes: fileSize(dbPath),
		counts: {
			matches: one(db.select({value: sql<number>`count(*)`}).from(matches)),
			players: one(db.select({value: sql<number>`count(*)`}).from(players)),
			events: one(db.select({value: sql<number>`count(*)`}).from(events)),
			marks: one(db.select({value: sql<number>`count(*)`}).from(marks)),
			aliases: one(db.select({value: sql<number>`count(*)`}).from(aliases)),
		},
		bySource: getSourceCounts(db).map((row) => ({key: row.key, count: Number(row.count)})),
		hiddenMatches: one(db.select({value: sql<number>`count(*)`}).from(matches).where(eq(matches.isHidden, 1))),
		hiddenPlayers: one(db.select({value: sql<number>`count(*)`}).from(players).where(eq(players.isHidden, 1))),
		lastIngestAt: db.select({value: sql<number>`max(${matches.ingestedAt})`}).from(matches).get()?.value ?? null,
	};
};

/**
 * Слияние двух ников в одного человека. Переписываем ключи во всех таблицах и
 * оставляем алиас, чтобы будущие партии со старым ником сразу ложились под
 * новый. Нужно постоянно: люди играют то как «Vasya», то как «вася_2».
 */
export const mergePlayers = (db: TDb, fromNickname: string, intoNickname: string) => {
	const from = nicknameKey(fromNickname);
	const into = nicknameKey(intoNickname);
	if (!from || !into) throw new Error('Нужны оба ника');
	if (from === into) throw new Error('Это один и тот же ник');
	const target = db.select().from(players).where(eq(players.key, into)).get();
	if (!target) throw new Error(`Игрок «${intoNickname}» не найден`);

	db.transaction((tx) => {
		// Один и тот же человек не может дважды сидеть за одним столом: если оба
		// ника участвовали в одной партии, вторую строку убираем — иначе
		// уникальный индекс (match_id, player_key) не даст переписать ключ.
		const collisions = tx
			.select({matchId: matchPlayers.matchId})
			.from(matchPlayers)
			.where(eq(matchPlayers.playerKey, into))
			.all()
			.map((row) => row.matchId);
		for (const matchId of collisions) {
			tx.delete(matchPlayers)
				.where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.playerKey, from)))
				.run();
		}

		tx.update(matchPlayers).set({playerKey: into}).where(eq(matchPlayers.playerKey, from)).run();
		tx.update(events).set({actorKey: into}).where(eq(events.actorKey, from)).run();
		tx.update(events).set({targetKey: into}).where(eq(events.targetKey, from)).run();
		tx.update(marks).set({actorKey: into}).where(eq(marks.actorKey, from)).run();
		tx.update(marks).set({targetKey: into}).where(eq(marks.targetKey, from)).run();
		const source = tx.select().from(players).where(eq(players.key, from)).get();
		if (source) {
			tx.update(players)
				.set({
					firstSeen: Math.min(source.firstSeen, target.firstSeen),
					lastSeen: Math.max(source.lastSeen, target.lastSeen),
				})
				.where(eq(players.key, into))
				.run();
			tx.delete(players).where(eq(players.key, from)).run();
		}
		tx.insert(aliases)
			.values({aliasKey: from, canonicalKey: into, createdAt: Date.now()})
			.onConflictDoUpdate({target: aliases.aliasKey, set: {canonicalKey: into}})
			.run();
	});
};

/** Переименовать игрока (меняется только отображаемое имя). */
export const renamePlayer = (db: TDb, key: string, displayName: string) => {
	if (!displayName.trim()) throw new Error('Пустое имя');
	db.update(players).set({displayName: displayName.trim()}).where(eq(players.key, key)).run();
};

export const setPlayerHidden = (db: TDb, key: string, hidden: boolean) => {
	db.update(players).set({isHidden: hidden ? 1 : 0}).where(eq(players.key, key)).run();
};

/**
 * Пересчёт таблицы статусов. Она целиком выводится из сырых событий (`events`),
 * поэтому пересобирается заново: так задним числом применяются и изменившиеся
 * правила оценки (`markScore`), и окно схлопывания транзитных нажатий
 * (`MARK_SETTLE_MS`), и слияние ников. Сами события при этом не трогаются —
 * операция безопасна и повторяема.
 */
export const recomputeMarks = (db: TDb): {matches: number; marks: number} => {
	const markEvents = db
		.select()
		.from(events)
		.where(eq(events.type, EAnalyticsEvent.mark))
		.orderBy(asc(events.matchId), asc(events.seq))
		.all();

	const byMatch = new Map<string, IMarkInput[]>();
	for (const event of markEvents) {
		if (!event.actorKey || !event.targetKey) continue;
		const detail = parseDetail(event.detail);
		const mark = typeof detail.mark === 'string' ? detail.mark : '';
		if (!mark) continue;
		const list = byMatch.get(event.matchId) ?? [];
		list.push({
			seq: event.seq,
			ts: event.ts,
			turn: event.turn,
			actorKey: event.actorKey,
			targetKey: event.targetKey,
			actor: event.actor ?? event.actorKey,
			target: event.target ?? event.targetKey,
			mark,
			previousMark: typeof detail.previousMark === 'string' ? detail.previousMark : null,
			targetWasThing: detail.targetWasThing === true,
			targetWasInfected: detail.targetWasInfected === true,
		});
		byMatch.set(event.matchId, list);
	}

	let written = 0;
	db.transaction((tx) => {
		for (const [matchId, inputs] of byMatch) {
			tx.delete(marks).where(eq(marks.matchId, matchId)).run();
			for (const row of buildMarkRows({matchId, inputs})) {
				tx.insert(marks).values(row).run();
				written += 1;
			}
		}
	});
	return {matches: byMatch.size, marks: written};
};

const parseDetail = (value: string): Record<string, unknown> => {
	try {
		const parsed: unknown = JSON.parse(value);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
	} catch {
		return {};
	}
};

/** Настройки центра. */
export const getSetting = (db: TDb, key: string, fallback: string): string =>
	db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? fallback;

export const setSetting = (db: TDb, key: string, value: string) => {
	db.insert(settings)
		.values({key, value})
		.onConflictDoUpdate({target: settings.key, set: {value}})
		.run();
};

/** Полный дамп базы — на случай переезда или ручного разбора. */
export const exportAll = (db: TDb) => ({
	exportedAt: Date.now(),
	matches: db.select().from(matches).all(),
	matchPlayers: db.select().from(matchPlayers).all(),
	players: db.select().from(players).all(),
	events: db.select().from(events).all(),
	marks: db.select().from(marks).all(),
	aliases: db.select().from(aliases).all(),
	settings: db.select().from(settings).all(),
});

const fileSize = (path: string): number => {
	try {
		return statSync(path).size;
	} catch {
		return 0;
	}
};
