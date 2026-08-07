import {and, asc, desc, eq, inArray, sql} from 'drizzle-orm';
import {events, marks, matchPlayers, matches} from 'analytics/db/schema';
import {matchFilter} from 'analytics/server/queries/filters';
import {EAnalyticsRole} from 'shared/analytics/contract';
import type {TDb} from 'analytics/db/client';
import type {IMatchDetail, IMatchEvent, IMatchRow, IStatsFilters} from 'analytics/shared/api';

/** Список партий (новые сверху). */
export const getMatches = (
	db: TDb,
	filters: IStatsFilters,
	{limit = 50, offset = 0, includeHidden = false}: {limit?: number; offset?: number; includeHidden?: boolean} = {},
): {rows: IMatchRow[]; total: number} => {
	const scope = includeHidden ? undefined : matchFilter(filters);
	const total = db.select({value: sql<number>`count(*)`}).from(matches).where(scope).get();
	const rows = db
		.select()
		.from(matches)
		.where(scope)
		.orderBy(desc(matches.startedAt))
		.limit(Math.min(limit, 500))
		.offset(offset)
		.all();

	const ids = rows.map((row) => row.matchId);
	const participants = ids.length
		? db.select().from(matchPlayers).where(inArray(matchPlayers.matchId, ids)).orderBy(asc(matchPlayers.seat)).all()
		: [];

	return {
		total: total?.value ?? 0,
		rows: rows.map((row) => {
			const own = participants.filter((p) => p.matchId === row.matchId);
			return {
				matchId: row.matchId,
				startedAt: row.startedAt,
				endedAt: row.endedAt,
				durationMs: row.durationMs,
				playerCount: row.playerCount,
				turns: row.turns,
				winner: row.winner,
				endReason: row.endReason,
				source: row.source,
				isComplete: row.isComplete === 1,
				isHidden: row.isHidden === 1,
				thing: own.find((p) => p.isThing === 1)?.nickname ?? null,
				players: own.map((p) => p.nickname),
			};
		}),
	};
};

/** Разбор одной партии: события, роли, лог. */
export const getMatchDetail = (db: TDb, matchId: string): IMatchDetail | null => {
	const row = db.select().from(matches).where(eq(matches.matchId, matchId)).get();
	if (!row) return null;
	const participants = db
		.select()
		.from(matchPlayers)
		.where(eq(matchPlayers.matchId, matchId))
		.orderBy(asc(matchPlayers.seat))
		.all();
	const eventRows = db.select().from(events).where(eq(events.matchId, matchId)).orderBy(asc(events.seq)).all();
	const markRows = db.select().from(marks).where(eq(marks.matchId, matchId)).orderBy(asc(marks.eventSeq)).all();

	return {
		match: {
			matchId: row.matchId,
			startedAt: row.startedAt,
			endedAt: row.endedAt,
			durationMs: row.durationMs,
			playerCount: row.playerCount,
			turns: row.turns,
			winner: row.winner,
			endReason: row.endReason,
			source: row.source,
			isComplete: row.isComplete === 1,
			isHidden: row.isHidden === 1,
			thing: participants.find((p) => p.isThing === 1)?.nickname ?? null,
			players: participants.map((p) => p.nickname),
		},
		seed: row.seed,
		endMessage: row.endMessage,
		players: participants.map((p) => ({
			nickname: p.nickname,
			key: p.playerKey,
			seat: p.seat,
			role: p.role as EAnalyticsRole,
			isWinner: p.isWinner === 1,
			survived: p.survived === 1,
			infectedAtTurn: p.infectedAtTurn,
		})),
		events: eventRows.map(
			(event): IMatchEvent => ({
				seq: event.seq,
				ts: event.ts,
				turn: event.turn,
				type: event.type,
				actor: event.actor,
				target: event.target,
				cardId: event.cardId,
				actorRole: event.actorRole,
				targetRole: event.targetRole,
				detail: safeJson(event.detail),
			}),
		),
		gameLog: safeLog(row.gameLog),
		marks: markRows.map((mark) => ({
			actor: mark.actor,
			target: mark.target,
			mark: mark.mark,
			turn: mark.turn,
			isCorrect: mark.isCorrect,
		})),
	};
};

/** Сколько партий из какого источника — для админки и мета-ручки. */
export const getSourceCounts = (db: TDb) =>
	db
		.select({key: matches.source, count: sql<number>`count(*)`})
		.from(matches)
		.groupBy(matches.source)
		.all();

/** Показать/спрятать партию (админка). */
export const setMatchHidden = (db: TDb, matchId: string, hidden: boolean) => {
	db.update(matches).set({isHidden: hidden ? 1 : 0}).where(eq(matches.matchId, matchId)).run();
};

/** Удалить партию целиком со всеми её событиями. */
export const deleteMatch = (db: TDb, matchId: string) => {
	db.transaction((tx) => {
		tx.delete(marks).where(eq(marks.matchId, matchId)).run();
		tx.delete(events).where(eq(events.matchId, matchId)).run();
		tx.delete(matchPlayers).where(eq(matchPlayers.matchId, matchId)).run();
		tx.delete(matches).where(eq(matches.matchId, matchId)).run();
	});
};

const safeJson = (value: string): Record<string, unknown> => {
	try {
		const parsed: unknown = JSON.parse(value);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
	} catch {
		return {};
	}
};

const safeLog = (value: string): {text: string; type: string}[] => {
	try {
		const parsed: unknown = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];
		return parsed
			.filter((line): line is {text: string; type: string} => !!line && typeof line === 'object')
			.map((line) => ({text: String(line.text ?? ''), type: String(line.type ?? 'info')}));
	} catch {
		return [];
	}
};

/** Условие «партия видна» — переиспользуется в админских выборках. */
export const visibleMatches = (filters: IStatsFilters) => and(matchFilter(filters));
