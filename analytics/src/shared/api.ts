// Формы ответов API. Один файл на бекенд и фронт: фронт импортирует эти типы
// напрямую (алиас `analytics/*` работает и в vite, и в bun).

/** Фильтры, общие для всех публичных ручек. */
export interface IStatsFilters {
	/** Какие источники считать: live (люди), bots (дев), e2e, test. */
	sources: string[];
	/** Считать ли партии с ботами. */
	includeBots: boolean;
	/** Считать ли недоигранные партии (в статистику побед они не идут никогда). */
	includeIncomplete: boolean;
	/** Границы периода, мс. */
	from: number | null;
	to: number | null;
	/** Минимум партий, чтобы игрок попал в рейтинг. */
	minMatches: number;
}

export interface ITotals {
	matches: number;
	completed: number;
	abandoned: number;
	players: number;
	events: number;
	marks: number;
	avgDurationMs: number;
	avgPlayers: number;
	avgTurns: number;
	firstMatchAt: number | null;
	lastMatchAt: number | null;
}

export interface IWinSplit {
	thing: number;
	humans: number;
}

export interface ICountRow {
	key: string;
	count: number;
}

export interface ITimelinePoint {
	date: string;
	matches: number;
	thing: number;
	humans: number;
}

export interface IWinRateByCount {
	playerCount: number;
	thing: number;
	humans: number;
}

export interface IMarkAccuracy {
	total: number;
	correct: number;
	wrong: number;
	rate: number;
}

/** Обзор: полностью обезличенная витрина — ни одного ника. */
export interface IOverview {
	totals: ITotals;
	winners: IWinSplit;
	winRateByPlayerCount: IWinRateByCount[];
	timeline: ITimelinePoint[];
	cards: ICountRow[];
	panics: ICountRow[];
	deaths: ICountRow[];
	markDistribution: ICountRow[];
	markAccuracy: IMarkAccuracy;
	markAccuracyByMark: {mark: string; total: number; correct: number; rate: number}[];
	/** Как быстро в среднем находят Нечто — распределение длительностей. */
	durationBuckets: ICountRow[];
	infections: {total: number; perMatch: number; byVia: ICountRow[]};
	/** На каком ходу в среднем заканчивается партия. */
	turnsBuckets: ICountRow[];
	filters: IStatsFilters;
}

export interface IPlayerSummary {
	key: string;
	displayName: string;
	matches: number;
	wins: number;
	losses: number;
	winRate: number;
	asThing: {matches: number; wins: number; winRate: number};
	asInfected: {matches: number; wins: number; winRate: number};
	asHuman: {matches: number; wins: number; winRate: number};
	survived: number;
	survivalRate: number;
	/** Скольких сжёг сам. */
	kills: number;
	/** Сколько раз сожгли его. */
	burned: number;
	/** Сколько раз сжёг именно Нечто (герой). */
	thingKills: number;
	/** Сколько раз сжёг чистого человека (мясник). */
	innocentKills: number;
	infectionsGiven: number;
	infectionsReceived: number;
	marksPlaced: number;
	accusations: number;
	markAccuracy: IMarkAccuracy;
	/** Итоговые мнения (последний статус на каждого) и их точность. */
	finalMarkAccuracy: IMarkAccuracy;
	timesAccused: number;
	timesWronglyAccused: number;
	cardsPlayed: number;
	firstSeen: number;
	lastSeen: number;
	isHidden: boolean;
	isBot: boolean;
}

/**
 * Статистика по одному типу статуса: сколько раз игрок его ставил и как часто
 * при этом был прав. «Под вопросом» и снятие статуса не оцениваются, поэтому у
 * них judged = 0 — но сколько раз их ставили, всё равно видно.
 */
export interface IMarkTypeStat {
	mark: string;
	/** Сколько раз поставил. */
	placed: number;
	/** Сколько из них поддаётся оценке. */
	judged: number;
	correct: number;
	wrong: number;
	rate: number;
}

export interface IPlayerRelation {
	key: string;
	displayName: string;
	marks: number;
	accusations: number;
	correct: number;
	wrong: number;
	accuracy: number;
}

export interface IPlayerMatchRow {
	matchId: string;
	startedAt: number;
	durationMs: number;
	playerCount: number;
	role: string;
	winner: string | null;
	isWinner: boolean;
	survived: boolean;
	isComplete: boolean;
}

export interface IPlayerDetail {
	summary: IPlayerSummary;
	cards: ICountRow[];
	/** Кого этот игрок подозревал. */
	suspected: IPlayerRelation[];
	/** Кто подозревал этого игрока. */
	suspectedBy: IPlayerRelation[];
	/** Кого он чаще всего жёг/анализировал. */
	targets: ICountRow[];
	matches: IPlayerMatchRow[];
	/** Точность подозрений по партиям — линия «прозрения». */
	accuracyTimeline: {date: string; rate: number; total: number}[];
	/** Разбивка «в каком статусе он ошибается»: по каждому типу отдельно. */
	marksByType: IMarkTypeStat[];
	deaths: ICountRow[];
	awards: IAward[];
}

export interface IAward {
	id: string;
	title: string;
	description: string;
	playerKey: string;
	playerName: string;
	value: number;
	unit: string;
}

export interface IMatrixCell {
	actor: string;
	target: string;
	marks: number;
	accusations: number;
	correct: number;
	wrong: number;
}

export interface IMatrix {
	players: {key: string; displayName: string}[];
	cells: IMatrixCell[];
}

export interface IMatchRow {
	matchId: string;
	startedAt: number;
	endedAt: number;
	durationMs: number;
	playerCount: number;
	turns: number;
	winner: string | null;
	endReason: string;
	source: string;
	isComplete: boolean;
	isHidden: boolean;
	thing: string | null;
	players: string[];
}

export interface IMatchEvent {
	seq: number;
	ts: number;
	turn: number;
	type: string;
	actor: string | null;
	target: string | null;
	cardId: string | null;
	actorRole: string | null;
	targetRole: string | null;
	detail: Record<string, unknown>;
}

export interface IMatchDetail {
	match: IMatchRow;
	seed: number;
	endMessage: string;
	players: {
		nickname: string;
		key: string;
		seat: number;
		role: string;
		isWinner: boolean;
		survived: boolean;
		infectedAtTurn: number | null;
	}[];
	events: IMatchEvent[];
	gameLog: {text: string; type: string}[];
	marks: {actor: string; target: string; mark: string; turn: number; isCorrect: number | null}[];
}

export interface IMeta {
	title: string;
	showNicknames: boolean;
	sources: ICountRow[];
	totals: {matches: number; players: number; events: number};
	lastMatchAt: number | null;
	contractVersion: number;
}

export interface IAdminStats {
	dbPath: string;
	dbSizeBytes: number;
	counts: {matches: number; players: number; events: number; marks: number; aliases: number};
	bySource: ICountRow[];
	hiddenMatches: number;
	hiddenPlayers: number;
	lastIngestAt: number | null;
}

// ------------------------------------------------------------------ огнемёт

/**
 * Приговор выстрелу из огнемёта:
 *  correct — чистый человек сжёг заражённого (или само Нечто);
 *  wrong   — чистый человек сжёг чистого: потерял союзника;
 *  byPlan  — стрелял заражённый или Нечто, это их игра, а не ошибка.
 */
export type TBurnVerdict = 'correct' | 'wrong' | 'byPlan';

export interface IVerdictSplit {
	correct: number;
	wrong: number;
	byPlan: number;
}

export interface IFlamethrowerShot {
	matchId: string;
	turn: number;
	shooterKey: string;
	victimKey: string;
	shooter: string;
	victim: string;
	shooterRole: string;
	victimRole: string;
	verdict: TBurnVerdict;
	/** Отбился «Никаким шашлыком». */
	saved: boolean;
	victimWasThing: boolean;
}

export interface IFlamethrowerShooter {
	key: string;
	displayName: string;
	shots: number;
	burned: number;
	saved: number;
	correct: number;
	wrong: number;
	byPlan: number;
	thingKills: number;
	/** Доля попаданий среди «судимых» выстрелов (correct / (correct + wrong)). */
	accuracy: number;
}

export interface IFlamethrowerVictim {
	key: string;
	displayName: string;
	targeted: number;
	burned: number;
	saved: number;
	burnedWrongly: number;
}

export interface IFlamethrowerPair {
	shooterKey: string;
	shooter: string;
	victimKey: string;
	victim: string;
	shots: number;
	burned: number;
	wrong: number;
}

export interface IFlamethrowerStats {
	totals: {
		attempts: number;
		burned: number;
		saved: number;
		/** Выстрелы без исхода: партия оборвалась между выбором цели и решением. */
		unresolved: number;
		saveRate: number;
		thingBurned: number;
	};
	burnsByVerdict: IVerdictSplit;
	savesByVerdict: IVerdictSplit;
	shooters: IFlamethrowerShooter[];
	victims: IFlamethrowerVictim[];
	pairs: IFlamethrowerPair[];
	turns: ICountRow[];
	filters: IStatsFilters;
}
