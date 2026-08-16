import {describe, expect, test} from 'bun:test';
import {EGameLogType} from 'shared/enum/gameLogType';
import type {IGameLogEntry} from 'shared/interfaces/gameLog';
import {
	getActionIcon,
	getStackEntries,
	getStackGeometry,
} from 'client/components/actionStack/actionStackModel';

// Стек действий строится из того же лога, что раньше читался строками: одна
// карточка — один законченный шаг. Здесь проверяется ровно это склеивание: что
// окажется на карточке, а что уедет к ней в подсказку.

const entry = (type: EGameLogType, text: string): IGameLogEntry => ({type, text});

const shape = (log: IGameLogEntry[]) => getStackEntries(log)
	.map((item) => [item.entry.text, ...item.details].join(' | '));

describe('карточки стека действий', () => {
	test('сид уезжает в подсказку к старту игры', () => {
		expect(shape([
			entry(EGameLogType.system, 'Сид игры: 42'),
			entry(EGameLogType.system, 'Игра началась'),
		])).toEqual(['Игра началась | Сид игры: 42']);
	});

	test('набор команды — одна карточка, кого взяли — в подсказке', () => {
		expect(shape([
			entry(EGameLogType.team, 'Миссия 1: Аня набирает 2 чел.'),
			entry(EGameLogType.team, 'Аня берёт в команду Борю'),
			entry(EGameLogType.team, 'Аня берёт в команду Веру'),
		])).toEqual(['Миссия 1: Аня набирает 2 чел. | Аня берёт в команду Борю | Аня берёт в команду Веру']);
	});

	test('голосование за этот состав — своя карточка, вместе со вскрытием', () => {
		expect(shape([
			entry(EGameLogType.team, 'Миссия 1: Аня набирает 2 чел.'),
			entry(EGameLogType.team, 'Аня берёт в команду Борю'),
			entry(EGameLogType.vote, 'Голосуем за команду: Аня, Боря'),
			entry(EGameLogType.vote, 'За: Аня. Против: Боря, Вера'),
			entry(EGameLogType.reject, 'Команда отклонена (1 из 5)'),
		])).toEqual([
			'Миссия 1: Аня набирает 2 чел. | Аня берёт в команду Борю',
			'Голосуем за команду: Аня, Боря | За: Аня. Против: Боря, Вера',
			'Команда отклонена (1 из 5)',
		]);
	});

	test('номер карточки — её место в полном логе, а не в стеке', () => {
		// По нему React узнаёт карточку между обновлениями: пропуски в номерах —
		// это как раз склеенные строки.
		expect(getStackEntries([
			entry(EGameLogType.system, 'Сид игры: 42'),
			entry(EGameLogType.system, 'Игра началась'),
			entry(EGameLogType.team, 'Миссия 1: Аня набирает 2 чел.'),
			entry(EGameLogType.team, 'Аня берёт в команду Борю'),
			entry(EGameLogType.vote, 'Голосуем за команду: Аня, Боря'),
		]).map((item) => item.id)).toEqual([1, 2, 4]);
	});
});

describe('знак на карточке', () => {
	test('исход миссии читается знаком, а не текстом', () => {
		const success = getActionIcon(entry(EGameLogType.success, 'Миссия 1 выполнена (провалов: 0)'));
		const fail = getActionIcon(entry(EGameLogType.fail, 'Миссия 2 сорвана (провалов: 1)'));
		expect(success).not.toBe(fail);
	});

	test('у каждого типа шага свой знак', () => {
		const icons = [
			EGameLogType.team,
			EGameLogType.vote,
			EGameLogType.reject,
			EGameLogType.mission,
			EGameLogType.success,
			EGameLogType.fail,
		].map((type) => getActionIcon(entry(type, 'что-то случилось')));
		expect(new Set(icons).size).toBe(icons.length);
	});

	test('строка без типа не остаётся без знака', () => {
		expect(getActionIcon({text: 'старая строка без типа'} as IGameLogEntry)).toBeTruthy();
	});
});

describe('раскладка стека', () => {
	test('карточки всегда лежат внахлёст', () => {
		const wide = getStackGeometry(500, 5);
		expect(wide.step).toBeLessThan(wide.cardWidth);
		expect(wide.trackWidth).toBeLessThanOrEqual(500);
	});

	test('стек любой глубины помещается в отведённую полосу', () => {
		for (const capacity of [1, 4, 6, 9, 12]) {
			for (const available of [280, 380, 500]) {
				const geometry = getStackGeometry(available, capacity);
				expect(geometry.trackWidth).toBeLessThanOrEqual(available + 0.001);
				expect(geometry.cardWidth).toBeGreaterThan(0);
			}
		}
	});
});
