import {describe, expect, it} from 'bun:test';
import {
	ANALYTICS_CONTRACT_VERSION,
	EAnalyticsEvent,
	EAnalyticsMark,
	EAnalyticsRole,
	EAnalyticsSource,
	EAnalyticsWinner,
	type IAnalyticsEvent,
	type IAnalyticsMatch,
} from 'shared/analytics/contract';
import {createDb} from 'analytics/db/client';
import {IngestError, ingestMatches} from 'analytics/db/ingest';
import {scoreMark} from 'analytics/db/markScore';
import {nicknameKey} from 'analytics/db/nicknames';
import {marks, matchPlayers, matches, players} from 'analytics/db/schema';
import {mergePlayers, recomputeMarks} from 'analytics/server/admin';
import {defaultFilters} from 'analytics/server/queries/filters';
import {getOverview} from 'analytics/server/queries/overview';
import {getPlayerDetail, getPlayers} from 'analytics/server/queries/players';
import {getMatrix} from 'analytics/server/queries/matrix';
import {getAwards} from 'analytics/server/queries/awards';
import {anonymizePlayers, buildAnonymizer} from 'analytics/server/privacy';
import {getFlamethrowerStats, verdictOf} from 'analytics/server/queries/flamethrower';

// Каждый тест берёт свою базу в памяти: миграции накатываются те же, что и в
// проде, так что заодно проверяется, что схема применима.
const freshDb = () => createDb(':memory:').db;

let seq = 0;
const event = (partial: Partial<IAnalyticsEvent> & {type: EAnalyticsEvent}): IAnalyticsEvent => {
	seq += 1;
	return {
		seq,
		// Раздвигаем события по времени: подряд идущие нажатия по одной цели
		// схлопнулись бы как «прокрутка» статуса (см. markRows.ts).
		ts: 1_700_000_000_000 + seq * 30_000,
		turn: 1,
		actor: null,
		target: null,
		cardId: null,
		actorRole: null,
		targetRole: null,
		detail: {},
		...partial,
	};
};

const mark = ({
	actor,
	target,
	value,
	targetWasThing = false,
	targetWasInfected = false,
}: {
	actor: string;
	target: string;
	value: EAnalyticsMark;
	targetWasThing?: boolean;
	targetWasInfected?: boolean;
}) =>
	event({
		type: EAnalyticsEvent.mark,
		actor,
		target,
		detail: {mark: value, previousMark: null, targetWasThing, targetWasInfected},
	});

const buildMatch = (partial: Partial<IAnalyticsMatch> = {}): IAnalyticsMatch => {
	seq = 0;
	return {
		matchId: 'match-1',
		seed: 42,
		source: EAnalyticsSource.live,
		startedAt: 1_700_000_000_000,
		endedAt: 1_700_000_600_000,
		durationMs: 600_000,
		playerCount: 3,
		turns: 12,
		winner: EAnalyticsWinner.humans,
		endReason: 'thing_burned' as IAnalyticsMatch['endReason'],
		endMessage: 'Нечто проиграло',
		isComplete: true,
		hasBots: false,
		players: [
			{
				nickname: 'Клык',
				seat: 0,
				isBot: false,
				isThing: true,
				infectedAtEnd: true,
				survived: false,
				isWinner: false,
				infectedAtTurn: null,
				role: EAnalyticsRole.thing,
			},
			{
				nickname: 'Док',
				seat: 1,
				isBot: false,
				isThing: false,
				infectedAtEnd: false,
				survived: true,
				isWinner: true,
				infectedAtTurn: null,
				role: EAnalyticsRole.human,
			},
			{
				nickname: 'Пилот',
				seat: 2,
				isBot: false,
				isThing: false,
				infectedAtEnd: false,
				survived: true,
				isWinner: true,
				infectedAtTurn: null,
				role: EAnalyticsRole.human,
			},
		],
		events: [
			event({type: EAnalyticsEvent.gameStart, detail: {seats: 'Клык, Док, Пилот'}}),
			event({type: EAnalyticsEvent.cardPlay, actor: 'Док', target: 'Клык', cardId: 'analysis'}),
			mark({actor: 'Док', target: 'Клык', value: EAnalyticsMark.thing, targetWasThing: true, targetWasInfected: true}),
			mark({actor: 'Пилот', target: 'Док', value: EAnalyticsMark.thing}),
			mark({actor: 'Пилот', target: 'Док', value: EAnalyticsMark.clear}),
			event({
				type: EAnalyticsEvent.death,
				actor: 'Док',
				target: 'Клык',
				detail: {cause: 'flamethrower', victimWasThing: true, victimWasInfected: true},
			}),
			event({type: EAnalyticsEvent.gameEnd, detail: {winner: 'humans'}}),
		],
		gameLog: [{text: 'Сид игры: 42', type: 'system'}],
		...partial,
	};
};

const ingest = (db: ReturnType<typeof freshDb>, ...list: IAnalyticsMatch[]) =>
	ingestMatches(db, {version: ANALYTICS_CONTRACT_VERSION, matches: list});

describe('Правота статуса', () => {
	it('«Нечто» верно только про само Нечто', () => {
		expect(scoreMark({mark: EAnalyticsMark.thing, targetWasThing: true, targetWasInfected: true})).toBe(true);
		expect(scoreMark({mark: EAnalyticsMark.thing, targetWasThing: false, targetWasInfected: true})).toBe(false);
	});

	it('«заражён» верно про любого заражённого, включая Нечто', () => {
		expect(scoreMark({mark: EAnalyticsMark.infected, targetWasThing: false, targetWasInfected: true})).toBe(true);
		expect(scoreMark({mark: EAnalyticsMark.infected, targetWasThing: true, targetWasInfected: true})).toBe(true);
		expect(scoreMark({mark: EAnalyticsMark.infected, targetWasThing: false, targetWasInfected: false})).toBe(false);
	});

	it('«чист» верно про незаражённого', () => {
		expect(scoreMark({mark: EAnalyticsMark.clear, targetWasThing: false, targetWasInfected: false})).toBe(true);
		expect(scoreMark({mark: EAnalyticsMark.clear, targetWasThing: false, targetWasInfected: true})).toBe(false);
	});

	it('«?» и снятие статуса мнением не считаются', () => {
		expect(scoreMark({mark: EAnalyticsMark.question, targetWasThing: true, targetWasInfected: true})).toBe(null);
		expect(scoreMark({mark: EAnalyticsMark.none, targetWasThing: true, targetWasInfected: true})).toBe(null);
	});
});

describe('Приём партий', () => {
	it('кладёт партию целиком', () => {
		const db = freshDb();
		const result = ingest(db, buildMatch());
		expect(result).toMatchObject({accepted: 1, duplicates: 0, rejected: 0});
		expect(db.select().from(matches).all().length).toBe(1);
		expect(db.select().from(matchPlayers).all().length).toBe(3);
		expect(db.select().from(players).all().length).toBe(3);
		expect(db.select().from(marks).all().length).toBe(3);
	});

	it('повторная доставка не плодит дублей', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		const second = ingest(db, buildMatch());
		expect(second).toMatchObject({accepted: 0, duplicates: 1});
		expect(db.select().from(matches).all().length).toBe(1);
	});

	it('ник — это человек без учёта регистра и пробелов', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		ingest(
			db,
			buildMatch({
				matchId: 'match-2',
				players: buildMatch().players.map((p) => ({...p, nickname: ` ${p.nickname.toUpperCase()} `})),
				events: [],
			}),
		);
		expect(db.select().from(players).all().length).toBe(3);
		expect(nicknameKey(' КлЫк ')).toBe('клык');
	});

	it('считает правоту статусов на входе', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		const rows = db.select().from(marks).all();
		const docOnKlyk = rows.find((row) => row.actorKey === 'док' && row.targetKey === 'клык');
		expect(docOnKlyk?.isCorrect).toBe(1);
		const wrong = rows.find((row) => row.actorKey === 'пилот' && row.mark === EAnalyticsMark.thing);
		expect(wrong?.isCorrect).toBe(0);
	});

	it('последний статус на цель помечается итоговым', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		const pilot = db.select().from(marks).all().filter((row) => row.actorKey === 'пилот');
		expect(pilot.length).toBe(2);
		expect(pilot.filter((row) => row.isFinal === 1).length).toBe(1);
		expect(pilot.find((row) => row.isFinal === 1)?.mark).toBe(EAnalyticsMark.clear);
	});

	it('отвергает мусор понятной ошибкой', () => {
		const db = freshDb();
		expect(() => ingestMatches(db, {version: 999, matches: []})).toThrow(IngestError);
		expect(() => ingestMatches(db, 'не объект')).toThrow(IngestError);
		const broken = ingest(db, buildMatch({players: []}));
		expect(broken.rejected).toBe(1);
		expect(db.select().from(matches).all().length).toBe(0);
	});
});

describe('Витрина', () => {
	it('обзор считает победы и точность', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		const overview = getOverview(db, defaultFilters());
		expect(overview.totals.matches).toBe(1);
		expect(overview.winners.humans).toBe(1);
		expect(overview.winners.thing).toBe(0);
		// Три статуса: один верный («Нечто» на Нечто), два про чистого Дока —
		// «Нечто» мимо, «чист» в точку.
		expect(overview.markAccuracy.total).toBe(3);
		expect(overview.markAccuracy.correct).toBe(2);
		expect(overview.cards.find((row) => row.key === 'analysis')?.count).toBe(1);
		expect(overview.deaths.find((row) => row.key === 'flamethrower')?.count).toBe(1);
	});

	it('обзор не содержит ников', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		const text = JSON.stringify(getOverview(db, defaultFilters()));
		expect(text).not.toContain('Клык');
		expect(text).not.toContain('Док');
	});

	it('рейтинг считает роли, победы и подозрения', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		const rows = getPlayers(db, defaultFilters());
		const doc = rows.find((row) => row.key === 'док');
		const klyk = rows.find((row) => row.key === 'клык');
		expect(doc?.matches).toBe(1);
		expect(doc?.wins).toBe(1);
		expect(doc?.asHuman.matches).toBe(1);
		expect(doc?.kills).toBe(1);
		expect(doc?.thingKills).toBe(1);
		expect(doc?.markAccuracy).toMatchObject({total: 1, correct: 1});
		expect(klyk?.asThing.matches).toBe(1);
		expect(klyk?.burned).toBe(1);
		// Дока обвинили один раз и зря.
		expect(doc?.timesAccused).toBe(1);
		expect(doc?.timesWronglyAccused).toBe(1);
	});

	it('партии с ботами по умолчанию не считаются', () => {
		const db = freshDb();
		ingest(db, buildMatch({matchId: 'bots', hasBots: true}));
		expect(getOverview(db, defaultFilters()).totals.matches).toBe(0);
		expect(getOverview(db, {...defaultFilters(), includeBots: true}).totals.matches).toBe(1);
	});

	it('матрица показывает, кто кого подозревал', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		const matrix = getMatrix(db, defaultFilters());
		expect(matrix.players.length).toBe(3);
		const cell = matrix.cells.find((row) => row.actor === 'пилот' && row.target === 'док');
		expect(cell?.marks).toBe(2);
		expect(cell?.accusations).toBe(1);
		expect(cell?.wrong).toBe(1);
	});

	it('титулы достаются людям, а не ботам', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		const awards = getAwards(getPlayers(db, {...defaultFilters(), minMatches: 0}));
		// Порог по партиям высокий — на одной партии титулов не выдаём.
		expect(awards.length).toBe(0);
	});
});

describe('Админка', () => {
	it('склеивает два ника в одного человека', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		ingest(
			db,
			buildMatch({
				matchId: 'match-2',
				players: [
					{...buildMatch().players[0]!, nickname: 'Клык'},
					{...buildMatch().players[1]!, nickname: 'Doc'},
					{...buildMatch().players[2]!, nickname: 'Пилот'},
				],
				events: [mark({actor: 'Doc', target: 'Клык', value: EAnalyticsMark.clear, targetWasInfected: true})],
			}),
		);
		expect(db.select().from(players).all().length).toBe(4);

		mergePlayers(db, 'Doc', 'Док');
		expect(db.select().from(players).all().length).toBe(3);
		const doc = getPlayers(db, {...defaultFilters(), minMatches: 0}).find((row) => row.key === 'док');
		expect(doc?.matches).toBe(2);
		// Статус, поставленный под старым ником, теперь тоже его.
		expect(doc?.markAccuracy.total).toBe(2);
	});

	it('новые партии со слитым ником сразу ложатся под основной', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		mergePlayers(db, 'Doc', 'Док');
		ingest(
			db,
			buildMatch({
				matchId: 'match-3',
				players: [
					{...buildMatch().players[0]!},
					{...buildMatch().players[1]!, nickname: 'Doc'},
					{...buildMatch().players[2]!},
				],
				events: [],
			}),
		);
		expect(db.select().from(players).all().find((row) => row.key === 'doc')).toBeUndefined();
		expect(getPlayers(db, {...defaultFilters(), minMatches: 0}).find((row) => row.key === 'док')?.matches).toBe(2);
	});

	it('пересчёт пересобирает статусы из событий и не меняет результат', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		const before = db.select().from(marks).all();
		const result = recomputeMarks(db);
		expect(result.matches).toBe(1);
		expect(result.marks).toBe(before.length);
		const after = db.select().from(marks).all();
		expect(after.map((row) => [row.eventSeq, row.mark, row.isCorrect, row.isFinal])).toEqual(
			before.map((row) => [row.eventSeq, row.mark, row.isCorrect, row.isFinal]),
		);
	});
});

describe('Прокрутка статуса', () => {
	// Игрок перебирает метку нажатиями по кружку: чист -> ? -> заражён -> Нечто.
	// Промежуточные нажатия — не мнение, а путь до нужного статуса.
	const scroll = (actor: string, target: string, marks: EAnalyticsMark[], gapMs: number, startTs = 1_700_000_100_000) =>
		marks.map((value, index) => {
			const item = mark({actor, target, value, targetWasThing: target === 'Клык', targetWasInfected: target === 'Клык'});
			return {...item, ts: startTs + index * gapMs};
		});

	it('быстрая прокрутка засчитывается одним статусом — тем, на котором остановились', () => {
		const db = freshDb();
		ingest(
			db,
			buildMatch({
				events: scroll('Пилот', 'Клык', [EAnalyticsMark.clear, EAnalyticsMark.question, EAnalyticsMark.infected, EAnalyticsMark.thing], 300),
			}),
		);
		const rows = db.select().from(marks).all();
		expect(rows.length).toBe(1);
		expect(rows[0]?.mark).toBe(EAnalyticsMark.thing);
		expect(rows[0]?.isCorrect).toBe(1);
		expect(rows[0]?.isFinal).toBe(1);
	});

	it('статус считается выбранным после 10 секунд тишины по этой цели', () => {
		const db = freshDb();
		ingest(
			db,
			buildMatch({
				matchId: 'gap-9s',
				events: [
					...scroll('Пилот', 'Клык', [EAnalyticsMark.clear], 0, 1_700_000_100_000),
					// Ещё не тишина: игрок всё ещё возится с этим кружком.
					...scroll('Пилот', 'Клык', [EAnalyticsMark.thing], 0, 1_700_000_109_000),
				],
			}),
		);
		expect(db.select().from(marks).all().length).toBe(1);
		expect(db.select().from(marks).all()[0]?.mark).toBe(EAnalyticsMark.thing);
	});

	it('запись остаётся с временем самого нажатия, а не с концом окна', () => {
		const db = freshDb();
		const clicks = scroll('Пилот', 'Клык', [EAnalyticsMark.clear, EAnalyticsMark.thing], 400, 1_700_000_100_000);
		ingest(db, buildMatch({events: clicks}));
		const row = db.select().from(marks).all()[0];
		expect(row?.ts).toBe(1_700_000_100_400);
		expect(row?.eventSeq).toBe(clicks[1]?.seq);
	});

	it('передумал позже — это уже отдельное мнение', () => {
		const db = freshDb();
		ingest(
			db,
			buildMatch({
				events: [
					...scroll('Пилот', 'Клык', [EAnalyticsMark.clear], 0, 1_700_000_100_000),
					...scroll('Пилот', 'Клык', [EAnalyticsMark.thing], 0, 1_700_000_180_000),
				],
			}),
		);
		const rows = db.select().from(marks).all().sort((a, b) => a.eventSeq - b.eventSeq);
		expect(rows.map((row) => row.mark)).toEqual([EAnalyticsMark.clear, EAnalyticsMark.thing]);
		expect(rows.map((row) => row.isFinal)).toEqual([0, 1]);
	});

	it('прокрутка по разным целям не схлопывается друг с другом', () => {
		const db = freshDb();
		ingest(
			db,
			buildMatch({
				events: [
					...scroll('Пилот', 'Клык', [EAnalyticsMark.clear], 0, 1_700_000_100_000),
					...scroll('Пилот', 'Док', [EAnalyticsMark.clear], 0, 1_700_000_100_100),
				],
			}),
		);
		expect(db.select().from(marks).all().length).toBe(2);
	});
});

describe('Обезличивание', () => {
	it('заменяет ники устойчивыми псевдонимами', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		const anon = buildAnonymizer(db, true);
		const rows = anonymizePlayers(getPlayers(db, {...defaultFilters(), minMatches: 0}), anon);
		expect(rows.every((row) => /^Игрок \d+$/.test(row.displayName))).toBe(true);
		// Псевдоним привязан к ключу, а не к месту в рейтинге: пересчёт его не меняет.
		expect(anon.name('док')).toBe(buildAnonymizer(db, true).name('док'));
		expect(anon.name('док')).not.toBe(anon.name('клык'));
	});

	it('выключённое обезличивание ничего не трогает', () => {
		const db = freshDb();
		ingest(db, buildMatch());
		const rows = anonymizePlayers(getPlayers(db, {...defaultFilters(), minMatches: 0}), buildAnonymizer(db, false));
		expect(rows.some((row) => row.displayName === 'Док')).toBe(true);
	});
});

describe('Огнемёт', () => {
	// Выстрел = card_play(flamethrower) с целью. Исход — либо death(flamethrower),
	// либо card_play(noFire), где actor спасшийся, а target стрелявший.
	const attempt = (shooter: string, victim: string, roles: {shooter: EAnalyticsRole; victim: EAnalyticsRole}) =>
		event({
			type: EAnalyticsEvent.cardPlay,
			cardId: 'flamethrower',
			actor: shooter,
			target: victim,
			actorRole: roles.shooter,
			targetRole: roles.victim,
		});

	const burn = (shooter: string, victim: string, roles: {shooter: EAnalyticsRole; victim: EAnalyticsRole}) =>
		event({
			type: EAnalyticsEvent.death,
			actor: shooter,
			target: victim,
			actorRole: roles.shooter,
			targetRole: roles.victim,
			detail: {
				cause: 'flamethrower',
				victimWasThing: roles.victim === EAnalyticsRole.thing,
				victimWasInfected: roles.victim !== EAnalyticsRole.human,
			},
		});

	const save = (saved: string, shooter: string, roles: {shooter: EAnalyticsRole; victim: EAnalyticsRole}) =>
		event({
			type: EAnalyticsEvent.cardPlay,
			cardId: 'noFire',
			actor: saved,
			target: shooter,
			actorRole: roles.victim,
			targetRole: roles.shooter,
		});

	const HUMAN = EAnalyticsRole.human;
	const INFECTED = EAnalyticsRole.infected;
	const THING = EAnalyticsRole.thing;

	it('чистый сжёг чистого — ошибка, чистый сжёг заражённого — попал', () => {
		const db = freshDb();
		ingest(
			db,
			buildMatch({
				events: [
					attempt('Док', 'Пилот', {shooter: HUMAN, victim: HUMAN}),
					burn('Док', 'Пилот', {shooter: HUMAN, victim: HUMAN}),
					attempt('Пилот', 'Клык', {shooter: HUMAN, victim: THING}),
					burn('Пилот', 'Клык', {shooter: HUMAN, victim: THING}),
				],
			}),
		);
		const stats = getFlamethrowerStats(db, defaultFilters());
		expect(stats.totals.attempts).toBe(2);
		expect(stats.totals.burned).toBe(2);
		expect(stats.burnsByVerdict).toMatchObject({correct: 1, wrong: 1, byPlan: 0});
		expect(stats.totals.thingBurned).toBe(1);
	});

	it('выстрел заражённого не судим — это часть плана', () => {
		const db = freshDb();
		ingest(
			db,
			buildMatch({
				events: [
					// Нечто жжёт своего заражённого ради алиби.
					attempt('Клык', 'Док', {shooter: THING, victim: INFECTED}),
					burn('Клык', 'Док', {shooter: THING, victim: INFECTED}),
					// Заражённый человек жжёт чистого — тоже его игра.
					attempt('Док', 'Пилот', {shooter: INFECTED, victim: HUMAN}),
					burn('Док', 'Пилот', {shooter: INFECTED, victim: HUMAN}),
				],
			}),
		);
		const stats = getFlamethrowerStats(db, defaultFilters());
		expect(stats.burnsByVerdict).toMatchObject({correct: 0, wrong: 0, byPlan: 2});
	});

	it('спасение шашлыком судится тем же приговором и не считается сожжением', () => {
		const db = freshDb();
		ingest(
			db,
			buildMatch({
				events: [
					attempt('Док', 'Пилот', {shooter: HUMAN, victim: HUMAN}),
					save('Пилот', 'Док', {shooter: HUMAN, victim: HUMAN}),
					attempt('Пилот', 'Клык', {shooter: HUMAN, victim: THING}),
					save('Клык', 'Пилот', {shooter: HUMAN, victim: THING}),
				],
			}),
		);
		const stats = getFlamethrowerStats(db, defaultFilters());
		expect(stats.totals.burned).toBe(0);
		expect(stats.totals.saved).toBe(2);
		expect(stats.totals.saveRate).toBe(1);
		expect(stats.savesByVerdict).toMatchObject({correct: 1, wrong: 1, byPlan: 0});
		expect(stats.burnsByVerdict).toMatchObject({correct: 0, wrong: 0, byPlan: 0});
	});

	it('считает стрелков, мишеней и пары', () => {
		const db = freshDb();
		ingest(
			db,
			buildMatch({
				events: [
					attempt('Док', 'Пилот', {shooter: HUMAN, victim: HUMAN}),
					burn('Док', 'Пилот', {shooter: HUMAN, victim: HUMAN}),
					attempt('Док', 'Клык', {shooter: HUMAN, victim: THING}),
					save('Клык', 'Док', {shooter: HUMAN, victim: THING}),
				],
			}),
		);
		const stats = getFlamethrowerStats(db, defaultFilters());
		const doc = stats.shooters.find((row) => row.key === 'док');
		expect(doc).toMatchObject({shots: 2, burned: 1, saved: 1, correct: 1, wrong: 1, accuracy: 0.5});

		const pilot = stats.victims.find((row) => row.key === 'пилот');
		expect(pilot).toMatchObject({targeted: 1, burned: 1, saved: 0, burnedWrongly: 1});
		const klyk = stats.victims.find((row) => row.key === 'клык');
		expect(klyk).toMatchObject({targeted: 1, burned: 0, saved: 1, burnedWrongly: 0});

		expect(stats.pairs.find((row) => row.shooterKey === 'док' && row.victimKey === 'пилот')).toMatchObject({
			shots: 1,
			burned: 1,
			wrong: 1,
		});
	});

	it('выстрел без исхода виден отдельно, а не как спасение', () => {
		const db = freshDb();
		ingest(db, buildMatch({events: [attempt('Док', 'Пилот', {shooter: HUMAN, victim: HUMAN})]}));
		const stats = getFlamethrowerStats(db, defaultFilters());
		expect(stats.totals).toMatchObject({attempts: 1, burned: 0, saved: 0, unresolved: 1});
	});

	it('приговор считается по ролям на момент выстрела', () => {
		expect(verdictOf(EAnalyticsRole.human, EAnalyticsRole.human)).toBe('wrong');
		expect(verdictOf(EAnalyticsRole.human, EAnalyticsRole.infected)).toBe('correct');
		expect(verdictOf(EAnalyticsRole.human, EAnalyticsRole.thing)).toBe('correct');
		expect(verdictOf(EAnalyticsRole.infected, EAnalyticsRole.human)).toBe('byPlan');
		expect(verdictOf(EAnalyticsRole.thing, EAnalyticsRole.infected)).toBe('byPlan');
	});
});

describe('Точность по типам статусов', () => {
	it('считает отдельно, где игрок ошибается, и не оценивает «под вопросом»', () => {
		const db = freshDb();
		ingest(
			db,
			buildMatch({
				events: [
					// Док про Клыка (Нечто): «чист» — мимо, «Нечто» — в точку.
					mark({actor: 'Док', target: 'Клык', value: EAnalyticsMark.clear, targetWasThing: true, targetWasInfected: true}),
					mark({actor: 'Док', target: 'Клык', value: EAnalyticsMark.thing, targetWasThing: true, targetWasInfected: true}),
					// Док про Пилота (чистого): «чист» — верно, «под вопросом» — не в счёт.
					mark({actor: 'Док', target: 'Пилот', value: EAnalyticsMark.clear}),
					mark({actor: 'Док', target: 'Пилот', value: EAnalyticsMark.question}),
				],
			}),
		);
		const detail = getPlayerDetail(db, 'док', {...defaultFilters(), minMatches: 0});
		const byType = new Map(detail?.marksByType.map((row) => [row.mark, row]));

		expect(byType.get(EAnalyticsMark.clear)).toMatchObject({placed: 2, judged: 2, correct: 1, wrong: 1, rate: 0.5});
		expect(byType.get(EAnalyticsMark.thing)).toMatchObject({placed: 1, judged: 1, correct: 1, wrong: 0, rate: 1});
		// «Под вопросом» видно, что ставили, но точность у него не считается.
		expect(byType.get(EAnalyticsMark.question)).toMatchObject({placed: 1, judged: 0, correct: 0, wrong: 0, rate: 0});
		// Неиспользованных типов в списке нет.
		expect(byType.has(EAnalyticsMark.none)).toBe(false);
	});

	it('порядок типов фиксированный — карточки игроков сравнимы построчно', () => {
		const db = freshDb();
		ingest(
			db,
			buildMatch({
				events: [
					mark({actor: 'Док', target: 'Пилот', value: EAnalyticsMark.thing}),
					mark({actor: 'Док', target: 'Клык', value: EAnalyticsMark.clear, targetWasThing: true, targetWasInfected: true}),
				],
			}),
		);
		const detail = getPlayerDetail(db, 'док', {...defaultFilters(), minMatches: 0});
		expect(detail?.marksByType.map((row) => row.mark)).toEqual([EAnalyticsMark.clear, EAnalyticsMark.thing]);
	});
});
