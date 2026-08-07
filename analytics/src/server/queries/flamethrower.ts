import {and, asc, eq, isNotNull, sql} from 'drizzle-orm';
import {events, matches, players} from 'analytics/db/schema';
import {matchFilter} from 'analytics/server/queries/filters';
import {EAnalyticsEvent, EAnalyticsRole} from 'shared/analytics/contract';
import {EEventID} from 'shared/enum/cards';
import type {TDb} from 'analytics/db/client';
import type {
	IFlamethrowerPair,
	IFlamethrowerShot,
	IFlamethrowerStats,
	IFlamethrowerShooter,
	IFlamethrowerVictim,
	IStatsFilters,
	TBurnVerdict,
} from 'analytics/shared/api';

/**
 * Отдельная статистика по огнемёту.
 *
 * Огнемёт — единственное необратимое действие в игре, поэтому его разбирают
 * дольше всего: «зачем ты меня сжёг». Ошибкой считается выстрел ЧИСТОГО
 * человека по ЧИСТОМУ человеку: он потерял союзника и приблизил победу Нечто.
 * Всё остальное ошибкой не является:
 *
 *  - чистый сжёг заражённого или само Нечто — попал (`correct`);
 *  - заражённый (или Нечто) сжёг кого угодно — это его игра, часть плана
 *    (`byPlan`): своего он жжёт, чтобы отвести подозрения, чужого — чтобы
 *    проредить чистых. Судить такой выстрел «правильностью» бессмысленно.
 *
 * Тот же приговор выносится и попыткам, которые отбили «Никаким шашлыком»:
 * спастись от правильного выстрела и спастись от ошибочного — разные истории.
 *
 * Роли берутся снимком на момент события, так что «он тогда ещё был чист»
 * учитывается само собой.
 */
export const getFlamethrowerStats = (db: TDb, filters: IStatsFilters): IFlamethrowerStats => {
	const scope = matchFilter(filters);

	// Попытка выстрела: карта сыграна и цель выбрана. Исход — отдельным событием.
	const attempts = db
		.select({
			matchId: events.matchId,
			seq: events.seq,
			turn: events.turn,
			ts: events.ts,
			shooterKey: events.actorKey,
			victimKey: events.targetKey,
			shooter: events.actor,
			victim: events.target,
			shooterRole: events.actorRole,
			victimRole: events.targetRole,
		})
		.from(events)
		.innerJoin(matches, eq(events.matchId, matches.matchId))
		.where(
			and(
				scope,
				eq(events.type, EAnalyticsEvent.cardPlay),
				eq(events.cardId, EEventID.flamethrower),
				isNotNull(events.targetKey),
			),
		)
		.orderBy(asc(events.matchId), asc(events.seq))
		.all();

	// Сожжения. Роли здесь свои, снятые в момент смерти, — на них и опираемся.
	const burns = db
		.select({
			matchId: events.matchId,
			seq: events.seq,
			turn: events.turn,
			shooterKey: events.actorKey,
			victimKey: events.targetKey,
			shooter: events.actor,
			victim: events.target,
			shooterRole: events.actorRole,
			victimRole: events.targetRole,
			victimWasThing: sql<number>`json_extract(${events.detail}, '$.victimWasThing')`,
		})
		.from(events)
		.innerJoin(matches, eq(events.matchId, matches.matchId))
		.where(
			and(
				scope,
				eq(events.type, EAnalyticsEvent.death),
				sql`json_extract(${events.detail}, '$.cause') = 'flamethrower'`,
				isNotNull(events.actorKey),
			),
		)
		.orderBy(asc(events.matchId), asc(events.seq))
		.all();

	// Спасения: actor — спасшийся, target — стрелявший (см. flamethrower.ts).
	const saves = db
		.select({
			matchId: events.matchId,
			seq: events.seq,
			turn: events.turn,
			savedKey: events.actorKey,
			shooterKey: events.targetKey,
			saved: events.actor,
			shooter: events.target,
			savedRole: events.actorRole,
			shooterRole: events.targetRole,
		})
		.from(events)
		.innerJoin(matches, eq(events.matchId, matches.matchId))
		.where(
			and(scope, eq(events.type, EAnalyticsEvent.cardPlay), eq(events.cardId, EEventID.noFire), isNotNull(events.targetKey)),
		)
		.orderBy(asc(events.matchId), asc(events.seq))
		.all();

	const shots: IFlamethrowerShot[] = [
		...burns.map(
			(row): IFlamethrowerShot => ({
				matchId: row.matchId,
				turn: row.turn,
				shooterKey: row.shooterKey ?? '',
				victimKey: row.victimKey ?? '',
				shooter: row.shooter ?? '',
				victim: row.victim ?? '',
				shooterRole: row.shooterRole ?? EAnalyticsRole.human,
				victimRole: row.victimRole ?? EAnalyticsRole.human,
				verdict: verdictOf(row.shooterRole, row.victimRole),
				saved: false,
				victimWasThing: Number(row.victimWasThing) === 1,
			}),
		),
		...saves.map(
			(row): IFlamethrowerShot => ({
				matchId: row.matchId,
				turn: row.turn,
				shooterKey: row.shooterKey ?? '',
				victimKey: row.savedKey ?? '',
				shooter: row.shooter ?? '',
				victim: row.saved ?? '',
				shooterRole: row.shooterRole ?? EAnalyticsRole.human,
				victimRole: row.savedRole ?? EAnalyticsRole.human,
				verdict: verdictOf(row.shooterRole, row.savedRole),
				saved: true,
				victimWasThing: row.savedRole === EAnalyticsRole.thing,
			}),
		),
	];

	const names = nameIndex(db);
	const shooters = new Map<string, IFlamethrowerShooter>();
	const victims = new Map<string, IFlamethrowerVictim>();
	const pairs = new Map<string, IFlamethrowerPair>();

	for (const shot of shots) {
		const shooter = shooters.get(shot.shooterKey) ?? emptyShooter(shot.shooterKey, names);
		shooter.shots += 1;
		if (shot.saved) shooter.saved += 1;
		else shooter.burned += 1;
		if (shot.verdict === 'correct') shooter.correct += 1;
		if (shot.verdict === 'wrong') shooter.wrong += 1;
		if (shot.verdict === 'byPlan') shooter.byPlan += 1;
		if (!shot.saved && shot.victimWasThing) shooter.thingKills += 1;
		shooters.set(shot.shooterKey, shooter);

		const victim = victims.get(shot.victimKey) ?? emptyVictim(shot.victimKey, names);
		victim.targeted += 1;
		if (shot.saved) victim.saved += 1;
		else victim.burned += 1;
		if (!shot.saved && shot.verdict === 'wrong') victim.burnedWrongly += 1;
		victims.set(shot.victimKey, victim);

		const pairKey = `${shot.shooterKey}>${shot.victimKey}`;
		const pair = pairs.get(pairKey) ?? {
			shooterKey: shot.shooterKey,
			shooter: names.get(shot.shooterKey) ?? shot.shooter,
			victimKey: shot.victimKey,
			victim: names.get(shot.victimKey) ?? shot.victim,
			shots: 0,
			burned: 0,
			wrong: 0,
		};
		pair.shots += 1;
		if (!shot.saved) pair.burned += 1;
		if (shot.verdict === 'wrong') pair.wrong += 1;
		pairs.set(pairKey, pair);
	}

	// Выстрелы, у которых не нашлось исхода: партия оборвалась между выбором цели
	// и решением. Показываем честно, а не прячем в «спасён».
	const resolved = shots.length;
	const unresolved = Math.max(0, attempts.length - resolved);

	const burnedShots = shots.filter((shot) => !shot.saved);
	const savedShots = shots.filter((shot) => shot.saved);

	return {
		totals: {
			attempts: attempts.length,
			burned: burnedShots.length,
			saved: savedShots.length,
			unresolved,
			saveRate: resolved ? round3(savedShots.length / resolved) : 0,
			thingBurned: burnedShots.filter((shot) => shot.victimWasThing).length,
		},
		burnsByVerdict: countVerdicts(burnedShots),
		savesByVerdict: countVerdicts(savedShots),
		shooters: [...shooters.values()]
			.map((row) => ({...row, accuracy: row.correct + row.wrong > 0 ? round3(row.correct / (row.correct + row.wrong)) : 0}))
			.sort((a, b) => b.shots - a.shots || b.correct - a.correct),
		victims: [...victims.values()].sort((a, b) => b.targeted - a.targeted),
		pairs: [...pairs.values()].sort((a, b) => b.shots - a.shots),
		turns: turnBuckets(shots),
		filters,
	};
};

/**
 * Приговор выстрелу. Судим только чистых людей: у них цель — найти заражённых,
 * и попадание в своего это провал. Выстрел заражённого — его собственная игра.
 */
export const verdictOf = (shooterRole: string | null, victimRole: string | null): TBurnVerdict => {
	if (shooterRole !== EAnalyticsRole.human) return 'byPlan';
	return victimRole === EAnalyticsRole.human ? 'wrong' : 'correct';
};

const countVerdicts = (shots: IFlamethrowerShot[]) => ({
	correct: shots.filter((shot) => shot.verdict === 'correct').length,
	wrong: shots.filter((shot) => shot.verdict === 'wrong').length,
	byPlan: shots.filter((shot) => shot.verdict === 'byPlan').length,
});

const turnBuckets = (shots: IFlamethrowerShot[]) => {
	const labels = ['1–5', '6–15', '16–30', '31–50', '50+'];
	const counts = [0, 0, 0, 0, 0];
	for (const shot of shots) {
		const index = shot.turn <= 5 ? 0 : shot.turn <= 15 ? 1 : shot.turn <= 30 ? 2 : shot.turn <= 50 ? 3 : 4;
		counts[index] = (counts[index] ?? 0) + 1;
	}
	return labels.map((key, index) => ({key, count: counts[index] ?? 0}));
};

const nameIndex = (db: TDb): Map<string, string> =>
	new Map(
		db
			.select({key: players.key, displayName: players.displayName})
			.from(players)
			.all()
			.map((row) => [row.key, row.displayName]),
	);

const emptyShooter = (key: string, names: Map<string, string>): IFlamethrowerShooter => ({
	key,
	displayName: names.get(key) ?? key,
	shots: 0,
	burned: 0,
	saved: 0,
	correct: 0,
	wrong: 0,
	byPlan: 0,
	thingKills: 0,
	accuracy: 0,
});

const emptyVictim = (key: string, names: Map<string, string>): IFlamethrowerVictim => ({
	key,
	displayName: names.get(key) ?? key,
	targeted: 0,
	burned: 0,
	saved: 0,
	burnedWrongly: 0,
});

const round3 = (value: number) => Math.round(value * 1000) / 1000;
