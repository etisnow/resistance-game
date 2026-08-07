import {and, count, desc, eq, inArray, isNotNull, sql} from 'drizzle-orm';
import {events, marks, matchPlayers, matches, players} from 'analytics/db/schema';
import {matchFilter} from 'analytics/server/queries/filters';
import {EAnalyticsEvent, EAnalyticsMark, EAnalyticsRole} from 'shared/analytics/contract';
import type {TDb} from 'analytics/db/client';
import type {
	ICountRow,
	IMarkAccuracy,
	IMarkTypeStat,
	IPlayerDetail,
	IPlayerMatchRow,
	IPlayerRelation,
	IPlayerSummary,
	IStatsFilters,
} from 'analytics/shared/api';

// Аккумулятор на игрока: считаем несколькими простыми запросами и склеиваем в
// памяти. Данных мало (узкая компания), зато каждый кусок читается глазами и
// проверяется по отдельности — один монолитный SQL с десятью LEFT JOIN так не
// умеет.
interface IAcc {
	matches: number;
	wins: number;
	survived: number;
	thingMatches: number;
	thingWins: number;
	infectedMatches: number;
	infectedWins: number;
	humanMatches: number;
	humanWins: number;
}

const emptyAcc = (): IAcc => ({
	matches: 0,
	wins: 0,
	survived: 0,
	thingMatches: 0,
	thingWins: 0,
	infectedMatches: 0,
	infectedWins: 0,
	humanMatches: 0,
	humanWins: 0,
});

/** Рейтинг игроков: одна строка на ник. */
export const getPlayers = (db: TDb, filters: IStatsFilters): IPlayerSummary[] => {
	const scope = matchFilter(filters);
	const participation = db
		.select({
			key: matchPlayers.playerKey,
			role: matchPlayers.role,
			isWinner: matchPlayers.isWinner,
			survived: matchPlayers.survived,
			value: count(),
		})
		.from(matchPlayers)
		.innerJoin(matches, eq(matchPlayers.matchId, matches.matchId))
		.where(and(scope, filters.includeBots ? undefined : eq(matchPlayers.isBot, 0)))
		.groupBy(matchPlayers.playerKey, matchPlayers.role, matchPlayers.isWinner, matchPlayers.survived)
		.all();

	const acc = new Map<string, IAcc>();
	for (const row of participation) {
		const item = acc.get(row.key) ?? emptyAcc();
		const won = row.isWinner === 1;
		item.matches += row.value;
		if (won) item.wins += row.value;
		if (row.survived === 1) item.survived += row.value;
		if (row.role === EAnalyticsRole.thing) {
			item.thingMatches += row.value;
			if (won) item.thingWins += row.value;
		} else if (row.role === EAnalyticsRole.infected) {
			item.infectedMatches += row.value;
			if (won) item.infectedWins += row.value;
		} else {
			item.humanMatches += row.value;
			if (won) item.humanWins += row.value;
		}
		acc.set(row.key, item);
	}

	const keys = [...acc.keys()];
	if (keys.length === 0) return [];

	const profiles = new Map(
		db
			.select()
			.from(players)
			.where(inArray(players.key, keys))
			.all()
			.map((row) => [row.key, row]),
	);

	const kills = countEvents(db, scope, EAnalyticsEvent.death, 'actor_key', sql`json_extract(detail, '$.cause') = 'flamethrower'`);
	const burned = countEvents(db, scope, EAnalyticsEvent.death, 'target_key', sql`json_extract(detail, '$.cause') = 'flamethrower'`);
	const thingKills = countEvents(db, scope, EAnalyticsEvent.death, 'actor_key', sql`json_extract(detail, '$.victimWasThing') = 1`);
	const innocentKills = countEvents(
		db,
		scope,
		EAnalyticsEvent.death,
		'actor_key',
		sql`json_extract(detail, '$.victimWasInfected') = 0 and json_extract(detail, '$.cause') = 'flamethrower'`,
	);
	const infectionsGiven = countEvents(db, scope, EAnalyticsEvent.infection, 'actor_key');
	const infectionsReceived = countEvents(db, scope, EAnalyticsEvent.infection, 'target_key');
	const cardsPlayed = countEvents(db, scope, EAnalyticsEvent.cardPlay, 'actor_key');

	const marksPlaced = countMarks(db, scope, marks.actorKey);
	const accusations = countMarks(db, scope, marks.actorKey, accusationFilter());
	const timesAccused = countMarks(db, scope, marks.targetKey, accusationFilter());
	const timesWronglyAccused = countMarks(db, scope, marks.targetKey, and(accusationFilter(), eq(marks.isCorrect, 0)));
	const accuracy = markAccuracyBy(db, scope, marks.actorKey, false);
	const finalAccuracy = markAccuracyBy(db, scope, marks.actorKey, true);

	return keys
		.map((key): IPlayerSummary => {
			const item = acc.get(key) ?? emptyAcc();
			const profile = profiles.get(key);
			return {
				key,
				displayName: profile?.displayName ?? key,
				matches: item.matches,
				wins: item.wins,
				losses: item.matches - item.wins,
				winRate: rate(item.wins, item.matches),
				asThing: {matches: item.thingMatches, wins: item.thingWins, winRate: rate(item.thingWins, item.thingMatches)},
				asInfected: {
					matches: item.infectedMatches,
					wins: item.infectedWins,
					winRate: rate(item.infectedWins, item.infectedMatches),
				},
				asHuman: {matches: item.humanMatches, wins: item.humanWins, winRate: rate(item.humanWins, item.humanMatches)},
				survived: item.survived,
				survivalRate: rate(item.survived, item.matches),
				kills: kills.get(key) ?? 0,
				burned: burned.get(key) ?? 0,
				thingKills: thingKills.get(key) ?? 0,
				innocentKills: innocentKills.get(key) ?? 0,
				infectionsGiven: infectionsGiven.get(key) ?? 0,
				infectionsReceived: infectionsReceived.get(key) ?? 0,
				marksPlaced: marksPlaced.get(key) ?? 0,
				accusations: accusations.get(key) ?? 0,
				markAccuracy: accuracy.get(key) ?? emptyAccuracy(),
				finalMarkAccuracy: finalAccuracy.get(key) ?? emptyAccuracy(),
				timesAccused: timesAccused.get(key) ?? 0,
				timesWronglyAccused: timesWronglyAccused.get(key) ?? 0,
				cardsPlayed: cardsPlayed.get(key) ?? 0,
				firstSeen: profile?.firstSeen ?? 0,
				lastSeen: profile?.lastSeen ?? 0,
				isHidden: profile?.isHidden === 1,
				isBot: profile?.isBot === 1,
			};
		})
		.filter((row) => !row.isHidden && row.matches >= filters.minMatches)
		.sort((a, b) => b.matches - a.matches || b.winRate - a.winRate);
};

/** Досье одного игрока. */
export const getPlayerDetail = (db: TDb, key: string, filters: IStatsFilters): IPlayerDetail | null => {
	const summary = getPlayers(db, {...filters, minMatches: 0}).find((row) => row.key === key);
	if (!summary) return null;
	const scope = matchFilter(filters);

	const cards = db
		.select({key: events.cardId, count: count()})
		.from(events)
		.innerJoin(matches, eq(events.matchId, matches.matchId))
		.where(and(scope, eq(events.type, EAnalyticsEvent.cardPlay), eq(events.actorKey, key), isNotNull(events.cardId)))
		.groupBy(events.cardId)
		.orderBy(desc(count()))
		.all();

	const targets = db
		.select({key: events.target, count: count()})
		.from(events)
		.innerJoin(matches, eq(events.matchId, matches.matchId))
		.where(and(scope, eq(events.type, EAnalyticsEvent.cardPlay), eq(events.actorKey, key), isNotNull(events.targetKey)))
		.groupBy(events.targetKey)
		.orderBy(desc(count()))
		.all();

	const deaths = db
		.select({key: sql<string>`json_extract(${events.detail}, '$.cause')`, count: count()})
		.from(events)
		.innerJoin(matches, eq(events.matchId, matches.matchId))
		.where(and(scope, eq(events.type, EAnalyticsEvent.death), eq(events.targetKey, key)))
		.groupBy(sql`json_extract(${events.detail}, '$.cause')`)
		.all();

	const matchRows = db
		.select({
			matchId: matches.matchId,
			startedAt: matches.startedAt,
			durationMs: matches.durationMs,
			playerCount: matches.playerCount,
			turns: matches.turns,
			winner: matches.winner,
			isComplete: matches.isComplete,
			role: matchPlayers.role,
			isWinner: matchPlayers.isWinner,
			survived: matchPlayers.survived,
		})
		.from(matchPlayers)
		.innerJoin(matches, eq(matchPlayers.matchId, matches.matchId))
		.where(and(scope, eq(matchPlayers.playerKey, key)))
		.orderBy(desc(matches.startedAt))
		.all();

	const accuracyTimeline = db
		.select({
			date: sql<string>`date(${marks.ts} / 1000, 'unixepoch')`,
			total: count(),
			correct: sql<number>`sum(case when ${marks.isCorrect} = 1 then 1 else 0 end)`,
		})
		.from(marks)
		.innerJoin(matches, eq(marks.matchId, matches.matchId))
		.where(and(scope, eq(marks.actorKey, key), isNotNull(marks.isCorrect)))
		.groupBy(sql`date(${marks.ts} / 1000, 'unixepoch')`)
		.orderBy(sql`date(${marks.ts} / 1000, 'unixepoch')`)
		.all();

	return {
		summary,
		marksByType: marksByType(db, scope, key),
		cards: cards.filter((r) => r.key).map((r) => ({key: String(r.key), count: r.count})),
		suspected: relations(db, scope, key, 'actor'),
		suspectedBy: relations(db, scope, key, 'target'),
		targets: targets.filter((r) => r.key).map((r) => ({key: String(r.key), count: r.count})),
		matches: matchRows.map(
			(row): IPlayerMatchRow => ({
				matchId: row.matchId,
				startedAt: row.startedAt,
				durationMs: row.durationMs,
				playerCount: row.playerCount,
				role: row.role,
				winner: row.winner,
				isWinner: row.isWinner === 1,
				survived: row.survived === 1,
				isComplete: row.isComplete === 1,
			}),
		),
		accuracyTimeline: accuracyTimeline.map((row) => ({
			date: row.date,
			total: row.total,
			rate: rate(Number(row.correct ?? 0), row.total),
		})),
		deaths: deaths.filter((r) => r.key).map((r) => ({key: String(r.key), count: r.count})),
		awards: [],
	};
};

/**
 * «В каком статусе он ошибается»: по каждому типу метки отдельно. Ровно тот
 * вопрос, который задают за столом — «ты вечно лепишь „чист“ не тем».
 *
 * Порядок фиксированный (как в самой игре при прокрутке), а не по частоте:
 * так две карточки разных игроков можно сравнивать построчно.
 */
const marksByType = (db: TDb, scope: ReturnType<typeof matchFilter>, key: string): IMarkTypeStat[] => {
	const rows = db
		.select({
			mark: marks.mark,
			placed: count(),
			judged: sql<number>`sum(case when ${marks.isCorrect} is null then 0 else 1 end)`,
			correct: sql<number>`sum(case when ${marks.isCorrect} = 1 then 1 else 0 end)`,
		})
		.from(marks)
		.innerJoin(matches, eq(marks.matchId, matches.matchId))
		.where(and(scope, eq(marks.actorKey, key)))
		.groupBy(marks.mark)
		.all();

	const order = [EAnalyticsMark.clear, EAnalyticsMark.question, EAnalyticsMark.infected, EAnalyticsMark.thing, EAnalyticsMark.none];
	return order
		.map((mark): IMarkTypeStat => {
			const row = rows.find((item) => item.mark === mark);
			const judged = Number(row?.judged ?? 0);
			const correct = Number(row?.correct ?? 0);
			return {
				mark,
				placed: row?.placed ?? 0,
				judged,
				correct,
				wrong: judged - correct,
				rate: rate(correct, judged),
			};
		})
		.filter((row) => row.placed > 0);
};

/**
 * Отношения по статусам: кого этот игрок подозревал (`actor`) или кто подозревал
 * его (`target`). Именно отсюда берётся ответ на «в отношении кого были
 * основные ошибки».
 */
const relations = (db: TDb, scope: ReturnType<typeof matchFilter>, key: string, side: 'actor' | 'target'): IPlayerRelation[] => {
	const own = side === 'actor' ? marks.actorKey : marks.targetKey;
	const other = side === 'actor' ? marks.targetKey : marks.actorKey;
	const otherName = side === 'actor' ? marks.target : marks.actor;
	const rows = db
		.select({
			key: other,
			displayName: sql<string>`max(${otherName})`,
			marks: count(),
			accusations: sql<number>`sum(case when ${marks.mark} in ('thing','infected') then 1 else 0 end)`,
			correct: sql<number>`sum(case when ${marks.isCorrect} = 1 then 1 else 0 end)`,
			wrong: sql<number>`sum(case when ${marks.isCorrect} = 0 then 1 else 0 end)`,
		})
		.from(marks)
		.innerJoin(matches, eq(marks.matchId, matches.matchId))
		.where(and(scope, eq(own, key)))
		.groupBy(other)
		.orderBy(desc(count()))
		.all();

	return rows.map((row) => {
		const correct = Number(row.correct ?? 0);
		const wrong = Number(row.wrong ?? 0);
		return {
			key: row.key,
			displayName: row.displayName ?? row.key,
			marks: row.marks,
			accusations: Number(row.accusations ?? 0),
			correct,
			wrong,
			accuracy: rate(correct, correct + wrong),
		};
	});
};

// ------------------------------------------------------------------ хелперы

const accusationFilter = () => inArray(marks.mark, [EAnalyticsMark.thing, EAnalyticsMark.infected]);

const countEvents = (
	db: TDb,
	scope: ReturnType<typeof matchFilter>,
	type: EAnalyticsEvent,
	column: 'actor_key' | 'target_key',
	extra?: ReturnType<typeof sql>,
): Map<string, number> => {
	const keyColumn = column === 'actor_key' ? events.actorKey : events.targetKey;
	const rows = db
		.select({key: keyColumn, value: count()})
		.from(events)
		.innerJoin(matches, eq(events.matchId, matches.matchId))
		.where(and(scope, eq(events.type, type), isNotNull(keyColumn), extra))
		.groupBy(keyColumn)
		.all();
	return new Map(rows.filter((row) => row.key).map((row) => [String(row.key), row.value]));
};

const countMarks = (
	db: TDb,
	scope: ReturnType<typeof matchFilter>,
	column: typeof marks.actorKey | typeof marks.targetKey,
	extra?: ReturnType<typeof and>,
): Map<string, number> => {
	const rows = db
		.select({key: column, value: count()})
		.from(marks)
		.innerJoin(matches, eq(marks.matchId, matches.matchId))
		.where(and(scope, extra))
		.groupBy(column)
		.all();
	return new Map(rows.map((row) => [row.key, row.value]));
};

const markAccuracyBy = (
	db: TDb,
	scope: ReturnType<typeof matchFilter>,
	column: typeof marks.actorKey,
	finalOnly: boolean,
): Map<string, IMarkAccuracy> => {
	const rows = db
		.select({
			key: column,
			total: count(),
			correct: sql<number>`sum(case when ${marks.isCorrect} = 1 then 1 else 0 end)`,
		})
		.from(marks)
		.innerJoin(matches, eq(marks.matchId, matches.matchId))
		.where(and(scope, isNotNull(marks.isCorrect), finalOnly ? eq(marks.isFinal, 1) : undefined))
		.groupBy(column)
		.all();
	return new Map(
		rows.map((row) => {
			const correct = Number(row.correct ?? 0);
			return [row.key, {total: row.total, correct, wrong: row.total - correct, rate: rate(correct, row.total)}];
		}),
	);
};

const emptyAccuracy = (): IMarkAccuracy => ({total: 0, correct: 0, wrong: 0, rate: 0});

export const rate = (part: number, total: number): number => (total > 0 ? Math.round((part / total) * 1000) / 1000 : 0);

export const asCountRows = (rows: {key: string | null; count: number}[]): ICountRow[] =>
	rows.filter((row) => row.key !== null).map((row) => ({key: String(row.key), count: row.count}));
