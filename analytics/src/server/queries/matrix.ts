import {and, count, eq, inArray, sql} from 'drizzle-orm';
import {marks, matchPlayers, matches, players} from 'analytics/db/schema';
import {matchFilter} from 'analytics/server/queries/filters';
import type {TDb} from 'analytics/db/client';
import type {IMatrix, IStatsFilters} from 'analytics/shared/api';

/**
 * Матрица подозрений: кто на кого сколько раз вешал статусы и как часто
 * попадал. Самая «компанейская» картинка во всём центре — по ней сразу видно
 * устойчивые пары «вечно подозревает» и «вечно под подозрением».
 */
export const getMatrix = (db: TDb, filters: IStatsFilters): IMatrix => {
	const scope = matchFilter(filters);

	// В матрицу берём только тех, кто реально играл в отобранных партиях, —
	// иначе таблица зарастает людьми с одной случайной партией из другого среза.
	const participants = db
		.select({key: matchPlayers.playerKey, value: count()})
		.from(matchPlayers)
		.innerJoin(matches, eq(matchPlayers.matchId, matches.matchId))
		.where(and(scope, filters.includeBots ? undefined : eq(matchPlayers.isBot, 0)))
		.groupBy(matchPlayers.playerKey)
		.all()
		.filter((row) => row.value >= filters.minMatches);

	const keys = participants.map((row) => row.key);
	if (keys.length === 0) return {players: [], cells: []};

	const profiles = db.select().from(players).where(inArray(players.key, keys)).all();
	const visible = profiles.filter((profile) => profile.isHidden === 0);

	const cells = db
		.select({
			actor: marks.actorKey,
			target: marks.targetKey,
			marks: count(),
			accusations: sql<number>`sum(case when ${marks.mark} in ('thing','infected') then 1 else 0 end)`,
			correct: sql<number>`sum(case when ${marks.isCorrect} = 1 then 1 else 0 end)`,
			wrong: sql<number>`sum(case when ${marks.isCorrect} = 0 then 1 else 0 end)`,
		})
		.from(marks)
		.innerJoin(matches, eq(marks.matchId, matches.matchId))
		.where(scope)
		.groupBy(marks.actorKey, marks.targetKey)
		.all();

	const visibleKeys = new Set(visible.map((profile) => profile.key));

	return {
		players: visible
			.map((profile) => ({key: profile.key, displayName: profile.displayName}))
			.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru')),
		cells: cells
			.filter((cell) => visibleKeys.has(cell.actor) && visibleKeys.has(cell.target))
			.map((cell) => ({
				actor: cell.actor,
				target: cell.target,
				marks: cell.marks,
				accusations: Number(cell.accusations ?? 0),
				correct: Number(cell.correct ?? 0),
				wrong: Number(cell.wrong ?? 0),
			})),
	};
};
