import {and, count, eq, isNotNull, sql} from 'drizzle-orm';
import {events, marks, matchPlayers, matches} from 'analytics/db/schema';
import {completedFilter, matchFilter} from 'analytics/server/queries/filters';
import {EAnalyticsEvent, EAnalyticsWinner} from 'shared/analytics/contract';
import type {TDb} from 'analytics/db/client';
import type {ICountRow, IOverview, IStatsFilters} from 'analytics/shared/api';

/**
 * Обзор — обезличенная витрина. Здесь принципиально нет ни одного ника: это та
 * часть статистики, которую не стыдно повесить на публичный домен, даже если
 * компания решит не светить, кто как играет.
 */
export const getOverview = (db: TDb, filters: IStatsFilters): IOverview => {
	const scope = matchFilter(filters);
	const completed = completedFilter(filters);

	const totalsRow = db
		.select({
			matches: count(),
			completed: sql<number>`coalesce(sum(${matches.isComplete}), 0)`,
			avgDuration: sql<number>`coalesce(avg(${matches.durationMs}), 0)`,
			avgPlayers: sql<number>`coalesce(avg(${matches.playerCount}), 0)`,
			avgTurns: sql<number>`coalesce(avg(${matches.turns}), 0)`,
			firstAt: sql<number | null>`min(${matches.startedAt})`,
			lastAt: sql<number | null>`max(${matches.startedAt})`,
		})
		.from(matches)
		.where(scope)
		.get();

	const playersCount = db
		.select({value: sql<number>`count(distinct ${matchPlayers.playerKey})`})
		.from(matchPlayers)
		.innerJoin(matches, eq(matchPlayers.matchId, matches.matchId))
		.where(and(scope, eq(matchPlayers.isBot, 0)))
		.get();

	const eventsCount = db
		.select({value: count()})
		.from(events)
		.innerJoin(matches, eq(events.matchId, matches.matchId))
		.where(scope)
		.get();

	const marksCount = db
		.select({value: count()})
		.from(marks)
		.innerJoin(matches, eq(marks.matchId, matches.matchId))
		.where(scope)
		.get();

	const winnerRows = db
		.select({winner: matches.winner, value: count()})
		.from(matches)
		.where(and(completed, isNotNull(matches.winner)))
		.groupBy(matches.winner)
		.all();

	const winners = {
		thing: winnerRows.find((r) => r.winner === EAnalyticsWinner.thing)?.value ?? 0,
		humans: winnerRows.find((r) => r.winner === EAnalyticsWinner.humans)?.value ?? 0,
	};

	const byPlayerCount = db
		.select({
			playerCount: matches.playerCount,
			thing: sql<number>`sum(case when ${matches.winner} = 'thing' then 1 else 0 end)`,
			humans: sql<number>`sum(case when ${matches.winner} = 'humans' then 1 else 0 end)`,
		})
		.from(matches)
		.where(completed)
		.groupBy(matches.playerCount)
		.orderBy(matches.playerCount)
		.all();

	const timeline = db
		.select({
			date: sql<string>`date(${matches.startedAt} / 1000, 'unixepoch')`,
			matches: count(),
			thing: sql<number>`sum(case when ${matches.winner} = 'thing' then 1 else 0 end)`,
			humans: sql<number>`sum(case when ${matches.winner} = 'humans' then 1 else 0 end)`,
		})
		.from(matches)
		.where(scope)
		.groupBy(sql`date(${matches.startedAt} / 1000, 'unixepoch')`)
		.orderBy(sql`date(${matches.startedAt} / 1000, 'unixepoch')`)
		.all();

	const cardRows = db
		.select({key: events.cardId, count: count()})
		.from(events)
		.innerJoin(matches, eq(events.matchId, matches.matchId))
		.where(and(scope, eq(events.type, EAnalyticsEvent.cardPlay), isNotNull(events.cardId)))
		.groupBy(events.cardId)
		.orderBy(sql`count(*) desc`)
		.all();

	const panicRows = db
		.select({key: events.cardId, count: count()})
		.from(events)
		.innerJoin(matches, eq(events.matchId, matches.matchId))
		.where(and(scope, eq(events.type, EAnalyticsEvent.panic), isNotNull(events.cardId)))
		.groupBy(events.cardId)
		.orderBy(sql`count(*) desc`)
		.all();

	const deathRows = db
		.select({key: sql<string>`json_extract(${events.detail}, '$.cause')`, count: count()})
		.from(events)
		.innerJoin(matches, eq(events.matchId, matches.matchId))
		.where(and(scope, eq(events.type, EAnalyticsEvent.death)))
		.groupBy(sql`json_extract(${events.detail}, '$.cause')`)
		.orderBy(sql`count(*) desc`)
		.all();

	const markRows = db
		.select({key: marks.mark, count: count()})
		.from(marks)
		.innerJoin(matches, eq(marks.matchId, matches.matchId))
		.where(scope)
		.groupBy(marks.mark)
		.orderBy(sql`count(*) desc`)
		.all();

	const accuracyRow = db
		.select({
			total: sql<number>`sum(case when ${marks.isCorrect} is null then 0 else 1 end)`,
			correct: sql<number>`sum(case when ${marks.isCorrect} = 1 then 1 else 0 end)`,
		})
		.from(marks)
		.innerJoin(matches, eq(marks.matchId, matches.matchId))
		.where(scope)
		.get();

	const accuracyByMark = db
		.select({
			mark: marks.mark,
			total: count(),
			correct: sql<number>`sum(case when ${marks.isCorrect} = 1 then 1 else 0 end)`,
		})
		.from(marks)
		.innerJoin(matches, eq(marks.matchId, matches.matchId))
		.where(and(scope, isNotNull(marks.isCorrect)))
		.groupBy(marks.mark)
		.all();

	const infectionRows = db
		.select({key: sql<string>`coalesce(json_extract(${events.detail}, '$.via'), 'unknown')`, count: count()})
		.from(events)
		.innerJoin(matches, eq(events.matchId, matches.matchId))
		.where(and(scope, eq(events.type, EAnalyticsEvent.infection)))
		.groupBy(sql`json_extract(${events.detail}, '$.via')`)
		.all();

	// Корзины отдаём в порядке возрастания, а не в том, в каком их вернул SQLite:
	// «30–60 мин» перед «5–15 мин» на оси выглядит поломкой.
	const durationRows = db
		.select({
			bucket: sql<number>`case
				when ${matches.durationMs} < 300000 then 0
				when ${matches.durationMs} < 900000 then 1
				when ${matches.durationMs} < 1800000 then 2
				when ${matches.durationMs} < 3600000 then 3
				else 4 end`,
			count: count(),
		})
		.from(matches)
		.where(scope)
		.groupBy(sql`1`)
		.orderBy(sql`1`)
		.all();

	const turnsRows = db
		.select({
			bucket: sql<number>`case
				when ${matches.turns} < 10 then 0
				when ${matches.turns} < 25 then 1
				when ${matches.turns} < 50 then 2
				when ${matches.turns} < 100 then 3
				else 4 end`,
			count: count(),
		})
		.from(matches)
		.where(scope)
		.groupBy(sql`1`)
		.orderBy(sql`1`)
		.all();

	const totalMatches = totalsRow?.matches ?? 0;
	const completedMatches = Number(totalsRow?.completed ?? 0);
	const infectionsTotal = infectionRows.reduce((sum, row) => sum + row.count, 0);
	const accuracyTotal = Number(accuracyRow?.total ?? 0);
	const accuracyCorrect = Number(accuracyRow?.correct ?? 0);

	return {
		totals: {
			matches: totalMatches,
			completed: completedMatches,
			abandoned: totalMatches - completedMatches,
			players: playersCount?.value ?? 0,
			events: eventsCount?.value ?? 0,
			marks: marksCount?.value ?? 0,
			avgDurationMs: Math.round(Number(totalsRow?.avgDuration ?? 0)),
			avgPlayers: round1(Number(totalsRow?.avgPlayers ?? 0)),
			avgTurns: round1(Number(totalsRow?.avgTurns ?? 0)),
			firstMatchAt: totalsRow?.firstAt ?? null,
			lastMatchAt: totalsRow?.lastAt ?? null,
		},
		winners,
		winRateByPlayerCount: byPlayerCount.map((row) => ({
			playerCount: row.playerCount,
			thing: Number(row.thing ?? 0),
			humans: Number(row.humans ?? 0),
		})),
		timeline: timeline.map((row) => ({
			date: row.date,
			matches: row.matches,
			thing: Number(row.thing ?? 0),
			humans: Number(row.humans ?? 0),
		})),
		cards: asCountRows(cardRows),
		panics: asCountRows(panicRows),
		deaths: asCountRows(deathRows),
		markDistribution: asCountRows(markRows),
		markAccuracy: {
			total: accuracyTotal,
			correct: accuracyCorrect,
			wrong: accuracyTotal - accuracyCorrect,
			rate: accuracyTotal ? accuracyCorrect / accuracyTotal : 0,
		},
		markAccuracyByMark: accuracyByMark.map((row) => ({
			mark: row.mark,
			total: row.total,
			correct: Number(row.correct ?? 0),
			rate: row.total ? Number(row.correct ?? 0) / row.total : 0,
		})),
		durationBuckets: labelBuckets(durationRows, DURATION_LABELS),
		infections: {
			total: infectionsTotal,
			perMatch: totalMatches ? round1(infectionsTotal / totalMatches) : 0,
			byVia: asCountRows(infectionRows),
		},
		turnsBuckets: labelBuckets(turnsRows, TURNS_LABELS),
		filters,
	};
};

const DURATION_LABELS = ['< 5 мин', '5–15 мин', '15–30 мин', '30–60 мин', '> 60 мин'];
const TURNS_LABELS = ['< 10', '10–24', '25–49', '50–99', '100+'];

const labelBuckets = (rows: {bucket: number; count: number}[], labels: string[]): ICountRow[] =>
	rows.map((row) => ({key: labels[Number(row.bucket)] ?? String(row.bucket), count: row.count}));

const asCountRows = (rows: {key: string | null; count: number}[]): ICountRow[] =>
	rows.filter((row) => row.key !== null).map((row) => ({key: String(row.key), count: row.count}));

const round1 = (value: number) => Math.round(value * 10) / 10;
