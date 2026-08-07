import {scoreMark} from 'analytics/db/markScore';
import type {marks} from 'analytics/db/schema';

/**
 * Статус выбирается «прокруткой»: игрок жмёт по кружку соседа, и метка
 * перебирается по кругу чист -> ? -> заражён -> Нечто -> снят. Каждое нажатие
 * долетает до сервера отдельным событием, поэтому путь до нужного статуса
 * оставляет за собой хвост промежуточных — человек через них лишь проходил, а
 * не утверждал.
 *
 * Считать их мнением нельзя: дойдя до «Нечто», игрок по дороге «сказал» ещё и
 * «чист», и «заражён», и оба попали бы в точность подозрений. Поэтому серия
 * нажатий по одной и той же цели схлопывается в одну — ту, на которой игрок
 * остановился: статус считается выбранным, когда по этой цели MARK_SETTLE_MS
 * ничего не нажимали.
 *
 * Ждать эти секунды в игре не нужно и нельзя — интерфейс должен отзываться
 * мгновенно. Ожидание здесь «задним числом»: сервер пишет каждое нажатие как
 * есть, а тишину после последнего из них аналитика видит уже в готовой партии.
 * Поэтому у записи стоит настоящее время и ход того самого нажатия, а не момент,
 * когда истёк бы таймер.
 *
 * Сырые нажатия никуда не деваются: они целиком лежат в таблице events.
 * Схлопывание — это то, как из них строится аналитическая таблица marks, и его
 * можно переиграть заново («Пересчитать статусы» в админке), в том числе с
 * другим окном.
 */
export const MARK_SETTLE_MS = settleWindow();

// Окно подбирается на глаз по живым данным, поэтому его можно поменять
// переменной окружения и пересобрать статусы, не трогая код.
function settleWindow(): number {
	const raw = Number(process.env.ANALYTICS_MARK_SETTLE_MS);
	return Number.isFinite(raw) && raw >= 0 ? raw : 10_000;
}

/** Одно нажатие по кружку, уже приведённое к каноничным ключам игроков. */
export interface IMarkInput {
	seq: number;
	ts: number;
	turn: number;
	actorKey: string;
	targetKey: string;
	actor: string;
	target: string;
	mark: string;
	previousMark: string | null;
	targetWasThing: boolean;
	targetWasInfected: boolean;
}

type TMarkRow = typeof marks.$inferInsert;

export const buildMarkRows = ({matchId, inputs}: {matchId: string; inputs: IMarkInput[]}): TMarkRow[] => {
	const settled = settleMarks(inputs);

	// Последнее слово каждого игрока о каждом соседе — по нему считается
	// «итоговое мнение».
	const lastSeqByPair = new Map<string, number>();
	for (const input of settled) lastSeqByPair.set(pairKey(input), input.seq);

	return settled.map((input) => ({
		matchId,
		eventSeq: input.seq,
		ts: input.ts,
		turn: input.turn,
		actorKey: input.actorKey,
		targetKey: input.targetKey,
		actor: input.actor,
		target: input.target,
		mark: input.mark,
		previousMark: input.previousMark,
		targetWasThing: input.targetWasThing ? 1 : 0,
		targetWasInfected: input.targetWasInfected ? 1 : 0,
		isCorrect: toFlag(
			scoreMark({
				mark: input.mark,
				targetWasThing: input.targetWasThing,
				targetWasInfected: input.targetWasInfected,
			}),
		),
		isFinal: lastSeqByPair.get(pairKey(input)) === input.seq ? 1 : 0,
	}));
};

/**
 * Выбросить транзитные нажатия. Идём по порядку и держим для каждой пары
 * «кто -> на кого» последнее оставленное нажатие: если следующее пришло по той
 * же паре быстрее MARK_SETTLE_MS, предыдущее было промежуточным — его убираем,
 * а `previousMark` наследуем от него, чтобы цепочка «от чего к чему» не рвалась.
 */
const settleMarks = (inputs: IMarkInput[]): IMarkInput[] => {
	const ordered = [...inputs].sort((a, b) => a.seq - b.seq);
	const kept: IMarkInput[] = [];
	const indexByPair = new Map<string, number>();

	for (const input of ordered) {
		const key = pairKey(input);
		const previousIndex = indexByPair.get(key);
		const previous = previousIndex === undefined ? undefined : kept[previousIndex];
		if (previous && input.ts - previous.ts <= MARK_SETTLE_MS) {
			kept[previousIndex as number] = {...input, previousMark: previous.previousMark};
			continue;
		}
		indexByPair.set(key, kept.length);
		kept.push(input);
	}
	return kept;
};

const pairKey = (input: {actorKey: string; targetKey: string}) => `${input.actorKey}>${input.targetKey}`;

const toFlag = (value: boolean | null): number | null => (value === null ? null : value ? 1 : 0);
