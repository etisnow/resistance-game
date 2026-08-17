import {describe, expect, test} from 'bun:test';
import {ESpecialRole} from 'shared/enum/role';
import {MERLIN_LIKE, RESISTANCE_SIDE, roleMarkOf, SPY_SIDE} from 'client/helpers/roleMark';
import type Player from 'client/models/Player';

// Чем кружок отмечен и с какого момента. Тайна партии держится не здесь (её
// держит formatPlayer — до смотрящего чужая роль просто не доезжает), а вот
// момент, когда стол называет роли вслух, — здесь: развязка и ни секундой раньше
// (FR-10).

const player = (fields: Partial<Player>): Player => ({
	isSpy: null,
	isMerlin: null,
	isAssassin: null,
	isPercival: null,
	isMorgana: null,
	looksLikeMerlin: null,
	...fields,
} as Player);

describe('жетон роли на кружке', () => {
	test('до развязки простая сторона жетоном не показывается', () => {
		// Так стол видит шпион: своих он знает всю партию, но буквами это не
		// пишут — сторону ему говорит кольцо.
		expect(roleMarkOf(player({isSpy: true}), false)).toBeNull();
		expect(roleMarkOf(player({isSpy: false}), false)).toBeNull();
	});

	test('на развязке жетон появляется у каждого, чья роль доехала', () => {
		expect(roleMarkOf(player({isSpy: true}), true)).toBe(SPY_SIDE);
		expect(roleMarkOf(player({isSpy: false}), true)).toBe(RESISTANCE_SIDE);
	});

	test('особая роль сильнее простой стороны', () => {
		// Иначе на развязке Мерлин стал бы просто сопротивленцем, а Убийца —
		// просто шпионом, и вся вторая половина партии осталась бы без объяснения.
		expect(roleMarkOf(player({isSpy: false, isMerlin: true}), true)).toBe(ESpecialRole.merlin);
		expect(roleMarkOf(player({isSpy: true, isAssassin: true}), true)).toBe(ESpecialRole.assassin);
		expect(roleMarkOf(player({isSpy: false, isPercival: true}), true)).toBe(ESpecialRole.percival);
		expect(roleMarkOf(player({isSpy: true, isMorgana: true}), true)).toBe(ESpecialRole.morgana);
	});

	test('догадка Персиваля живёт до развязки, а на ней уступает правде', () => {
		expect(roleMarkOf(player({looksLikeMerlin: true}), false)).toBe(MERLIN_LIKE);
		// На развязке к тому же игроку приходит и настоящая роль — показываем её.
		expect(roleMarkOf(player({isSpy: true, isMorgana: true, looksLikeMerlin: true}), true))
			.toBe(ESpecialRole.morgana);
	});

	test('чужой роли нет — нет и жетона', () => {
		// До развязки сопротивленец видит стол именно так: у соседей null во всём.
		expect(roleMarkOf(player({}), false)).toBeNull();
		expect(roleMarkOf(player({}), true)).toBeNull();
	});
});
