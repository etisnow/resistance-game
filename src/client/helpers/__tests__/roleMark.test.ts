import {describe, expect, test} from 'bun:test';
import {ESpecialRole} from 'shared/enum/role';
import {MERLIN_LIKE, roleMarkOf} from 'client/helpers/roleMark';
import type Player from 'client/models/Player';

// Чем кружок отмечен. Тайна партии держится не здесь (её держит formatPlayer —
// до смотрящего чужая роль просто не доезжает): сюда роль доходит только тогда,
// когда смотрящему её и правда положено видеть. Жетон есть у особых ролей и
// только у них — простую сторону, даже на развязке (FR-10), говорит кольцо.

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
	test('простая сторона жетоном не показывается — даже на развязке', () => {
		// Так стол видит шпион: своих он знает всю партию, а на развязке их знают
		// все. Но буквами это не пишут — сторону говорит кольцо.
		expect(roleMarkOf(player({isSpy: true}))).toBeNull();
		expect(roleMarkOf(player({isSpy: false}))).toBeNull();
	});

	test('особая роль сильнее простой стороны', () => {
		// Иначе на развязке Мерлин стал бы просто сопротивленцем, а Убийца —
		// просто шпионом, и вся вторая половина партии осталась бы без объяснения.
		expect(roleMarkOf(player({isSpy: false, isMerlin: true}))).toBe(ESpecialRole.merlin);
		expect(roleMarkOf(player({isSpy: true, isAssassin: true}))).toBe(ESpecialRole.assassin);
		expect(roleMarkOf(player({isSpy: false, isPercival: true}))).toBe(ESpecialRole.percival);
		expect(roleMarkOf(player({isSpy: true, isMorgana: true}))).toBe(ESpecialRole.morgana);
	});

	test('догадка Персиваля уступает правде, когда та доехала', () => {
		expect(roleMarkOf(player({looksLikeMerlin: true}))).toBe(MERLIN_LIKE);
		// На развязке к тому же игроку приходит и настоящая роль — показываем её.
		expect(roleMarkOf(player({isSpy: true, isMorgana: true, looksLikeMerlin: true})))
			.toBe(ESpecialRole.morgana);
	});

	test('чужой роли нет — нет и жетона', () => {
		// До развязки сопротивленец видит стол именно так: у соседей null во всём.
		expect(roleMarkOf(player({}))).toBeNull();
	});
});
