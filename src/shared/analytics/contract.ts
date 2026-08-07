// Контракт аналитики: единственный источник правды о том, что игровой сервер
// отправляет в аналитический центр (`analytics/`). Здесь только типы и строковые
// енумы — ни одного импорта из движка, чтобы этот файл могли одинаково читать и
// бекенд игры, и бекенд аналитики, и её фронт.
//
// Партия уезжает В АНАЛИТИКУ ЦЕЛИКОМ И ТОЛЬКО ПОСЛЕ ОКОНЧАНИЯ (см.
// server/analytics/recorder.ts): пока за столом идёт игра, наружу не уходит
// ничего — иначе публичный сайт стал бы читом (кто Нечто видно из ролей).

/** Версия формата пакета. Поднимаем при несовместимых изменениях. */
export const ANALYTICS_CONTRACT_VERSION = 1;

/** Тип события в партии. Значения пишутся в базу как есть — не переименовывать. */
export enum EAnalyticsEvent {
	/** Партия началась: роли розданы, за столом столько-то людей. */
	gameStart = 'game_start',
	/** Ход перешёл к игроку. */
	turnStart = 'turn_start',
	/** Игрок взял карту из колоды. */
	cardDraw = 'card_draw',
	/** Игрок разыграл карту события (target — на кого, если карта прицельная). */
	cardPlay = 'card_play',
	/** Игрок сбросил карту, не разыгрывая. */
	cardDiscard = 'card_discard',
	/** Игрок предложил обмен соседу (offense). */
	tradeOffer = 'trade_offer',
	/** Обмен состоялся: обе карты уехали к новым владельцам. */
	tradeComplete = 'trade_complete',
	/** Обмен сорван защитной картой (страх / нет уж спасибо / мимо). */
	tradeRefuse = 'trade_refuse',
	/** Вытянута карта паники. */
	panic = 'panic',
	/** Игрок заразился (source — от кого, если известно). */
	infection = 'infection',
	/** Игрок выбыл из игры. */
	death = 'death',
	/** Игрока посадили на карантин. */
	quarantine = 'quarantine',
	/** Игрок поставил (или снял) статус на другом игроке. */
	mark = 'mark',
	/** Игрок принял решение в диалоге (сгореть / шашлык / меняться / отказ). */
	decision = 'decision',
	/** Партия закончилась. */
	gameEnd = 'game_end',
}

/** Статус, который игрок вешает на другого игрока (см. EPlayerMark движка). */
export enum EAnalyticsMark {
	clear = 'clear',
	question = 'question',
	infected = 'infected',
	thing = 'thing',
	none = 'none',
}

/** Кто на самом деле был этим игроком в момент события. */
export enum EAnalyticsRole {
	/** Само Нечто. */
	thing = 'thing',
	/** Заражённый человек (не Нечто). */
	infected = 'infected',
	/** Чистый человек. */
	human = 'human',
}

/** Сторона, выигравшая партию. */
export enum EAnalyticsWinner {
	thing = 'thing',
	humans = 'humans',
}

/** От чего игрок выбыл. */
export enum EAnalyticsDeathCause {
	/** Сожжён огнемётом. */
	flamethrower = 'flamethrower',
	/** Рука целиком из «Заражение!» — игрок сгорает изнутри. */
	overinfect = 'overinfect',
	/** Всё остальное (панические карты и прочее). */
	other = 'other',
}

/** Как игра закончилась — для разбора «почему». */
export enum EAnalyticsEndReason {
	/** Нечто сожгли. */
	thingBurned = 'thing_burned',
	/** Заражены все живые. */
	allInfected = 'all_infected',
	/** За столом остался один живой. */
	lastSurvivor = 'last_survivor',
	/** Комнату закрыли, не доиграв. */
	abandoned = 'abandoned',
	other = 'other',
}

/** Откуда пришла партия: разделяем настоящие игры, дев-ботов и e2e. */
export enum EAnalyticsSource {
	live = 'live',
	bots = 'bots',
	e2e = 'e2e',
	test = 'test',
}

/**
 * Дополнительные поля события. Значения простые, чтобы лечь в JSON-колонку и
 * читаться на фронте без разбора схем.
 */
export type TAnalyticsDetail = Record<string, string | number | boolean | null>;

/** Одно событие партии. `actor`/`target` — ники, а не внутренние id игроков. */
export interface IAnalyticsEvent {
	/** Порядковый номер события внутри партии (с 1). */
	seq: number;
	/** Unix-время в мс. */
	ts: number;
	/** Номер хода (сколько раз ход менялся с начала партии). */
	turn: number;
	type: EAnalyticsEvent;
	/** Кто сделал (ник). */
	actor: string | null;
	/** С кем сделали (ник). */
	target: string | null;
	/** Карта события/паники, если событие про карту. */
	cardId: string | null;
	/** Роль актора на момент события — чтобы считать статистику «за Нечто». */
	actorRole: EAnalyticsRole | null;
	/** Роль цели на момент события — по ней считается правота статусов. */
	targetRole: EAnalyticsRole | null;
	detail: TAnalyticsDetail;
}

/** Итог партии для одного игрока. */
export interface IAnalyticsMatchPlayer {
	nickname: string;
	/** Место за столом (0-based, в порядке рассадки). */
	seat: number;
	isBot: boolean;
	/** Был ли этот игрок Нечто. */
	isThing: boolean;
	/** Был ли заражён на момент конца партии. */
	infectedAtEnd: boolean;
	/** Дожил ли до конца. */
	survived: boolean;
	/** В выигравшей ли стороне оказался. */
	isWinner: boolean;
	/** На каком ходу заразился (null — не заражался или был Нечто с начала). */
	infectedAtTurn: number | null;
	role: EAnalyticsRole;
}

/** Строка игрового лога — сохраняем, чтобы партию можно было перечитать. */
export interface IAnalyticsLogLine {
	text: string;
	type: string;
}

/** Полная запись одной партии — атомарная единица отправки. */
export interface IAnalyticsMatch {
	/** Уникальный id партии (генерится в начале игры). Идемпотентность ingest. */
	matchId: string;
	/** Сид движка — по нему партия воспроизводима. */
	seed: number;
	source: EAnalyticsSource;
	startedAt: number;
	endedAt: number;
	durationMs: number;
	playerCount: number;
	/** Сколько ходов успели сыграть. */
	turns: number;
	winner: EAnalyticsWinner | null;
	endReason: EAnalyticsEndReason;
	/** Итоговая строка движка («Нечто победило» и т.п.) — для наглядности. */
	endMessage: string;
	/** false — партию бросили, в статистику побед она не идёт. */
	isComplete: boolean;
	hasBots: boolean;
	players: IAnalyticsMatchPlayer[];
	events: IAnalyticsEvent[];
	gameLog: IAnalyticsLogLine[];
}

/** Тело запроса POST /api/ingest. */
export interface IAnalyticsIngestPayload {
	version: number;
	matches: IAnalyticsMatch[];
}

/** Ответ ingest: сколько партий принято и сколько отброшено как дубли. */
export interface IAnalyticsIngestResult {
	accepted: number;
	duplicates: number;
	rejected: number;
	errors?: string[];
}
