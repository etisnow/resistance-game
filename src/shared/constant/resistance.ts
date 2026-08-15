// Правила «Сопротивления» в числах. Таблицами, а не формулами: закономерности в
// них нет, и любая «выведенная» формула рано или поздно разойдётся с игрой.
// Источник — правила базовой коробки, см. docs/PRD.md, раздел 2.

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;

/** Всего миссий в партии и сколько нужно выиграть, чтобы взять партию. */
export const MISSIONS_COUNT = 5;
export const MISSIONS_TO_WIN = 3;

/** Столько отклонений подряд в одном раунде — и партия уходит шпионам. */
export const MAX_REJECTS = 5;

/** Сколько шпионов за столом при таком числе игроков. */
const SPY_COUNT: Record<number, number> = {5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4};

/** Размер команды: по числу игроков, затем по номеру миссии (0..4). */
const TEAM_SIZE: Record<number, number[]> = {
	5:  [2, 3, 2, 3, 3],
	6:  [2, 3, 4, 3, 4],
	7:  [2, 3, 3, 4, 4],
	8:  [3, 4, 4, 5, 5],
	9:  [3, 4, 4, 5, 5],
	10: [3, 4, 4, 5, 5],
};

export const isPlayableCount = (playersCount: number): boolean =>
	playersCount >= MIN_PLAYERS && playersCount <= MAX_PLAYERS;

export const spyCount = (playersCount: number): number => {
	const count = SPY_COUNT[playersCount];
	if (count === undefined) throw new Error(`Нет состава ролей для ${playersCount} игроков`);
	return count;
};

export const teamSize = (playersCount: number, missionIndex: number): number => {
	const sizes = TEAM_SIZE[playersCount];
	const size = sizes ? sizes[missionIndex] : undefined;
	if (size === undefined) throw new Error(`Нет размера команды: ${playersCount} игроков, миссия ${missionIndex}`);
	return size;
};

/**
 * Сколько карт «Провал» нужно, чтобы сорвать эту миссию. Обычно одной хватает, и
 * только четвёртая миссия за столом от семи человек требует двух — иначе один
 * шпион в большой команде срывает её в одиночку.
 */
export const failsNeeded = (missionIndex: number, playersCount: number): number =>
	missionIndex === 3 && playersCount >= 7 ? 2 : 1;
