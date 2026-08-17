import {describe, expect, test} from 'bun:test';
import {ESpecialRole} from 'shared/enum/role';
import {MERLIN_LIKE, RESISTANCE_SIDE, ROLE_MARK_LOOK, SPY_SIDE, type TRoleMark} from 'client/helpers/roleMark';
import {roleHintText} from 'client/components/hint/RoleHint';

// Жетон роли на кружке — буква, и объясняет её только подсказка. Видят её разные
// люди: свой жетон — сам игрок, чужих Убийцу и Моргану — напарники по шпионажу,
// а на развязке все жетоны открыты столу. Поэтому текстов у роли два.

const ALL_MARKS: TRoleMark[] = [
	ESpecialRole.merlin,
	ESpecialRole.assassin,
	ESpecialRole.percival,
	ESpecialRole.morgana,
	MERLIN_LIKE,
	SPY_SIDE,
	RESISTANCE_SIDE,
];

describe('жетоны ролей', () => {
	test('буквы у жетонов разные — иначе роли не различить', () => {
		const letters = ALL_MARKS.map((mark) => ROLE_MARK_LOOK[mark].text);
		expect(new Set(letters).size).toBe(letters.length);
	});

	test('сторона читается цветом: у шпионов свой, у сопротивления свой', () => {
		expect(ROLE_MARK_LOOK[ESpecialRole.morgana].fill).toBe(ROLE_MARK_LOOK[ESpecialRole.assassin].fill);
		expect(ROLE_MARK_LOOK[ESpecialRole.merlin].fill).not.toBe(ROLE_MARK_LOOK[ESpecialRole.assassin].fill);
		// Жетоны развязки — той же двух красок: цвет здесь и есть сторона, и
		// заводить простому шпиону третью значило бы сказать ею что-то ещё.
		expect(ROLE_MARK_LOOK[SPY_SIDE].fill).toBe(ROLE_MARK_LOOK[ESpecialRole.assassin].fill);
		expect(ROLE_MARK_LOOK[RESISTANCE_SIDE].fill).toBe(ROLE_MARK_LOOK[ESpecialRole.merlin].fill);
	});

	test('догадка Персиваля выглядит как догадка, а не как Мерлин', () => {
		// Иначе Персиваль читал бы её как «вот он, Мерлин», а он этого не знает.
		expect(ROLE_MARK_LOOK[MERLIN_LIKE].text).not.toBe(ROLE_MARK_LOOK[ESpecialRole.merlin].text);
		expect(ROLE_MARK_LOOK[MERLIN_LIKE].fill).not.toBe(ROLE_MARK_LOOK[ESpecialRole.merlin].fill);
	});
});

describe('подсказка жетона роли', () => {
	test('у каждого жетона свой текст, и свой отличается от чужого', () => {
		const texts = ALL_MARKS.flatMap((mark) => [roleHintText(mark, true), roleHintText(mark, false)]);
		texts.forEach((text) => expect(text.length).toBeGreaterThan(0));
		// У всех, кроме догадки Персиваля: у неё «свой» жетон не бывает, и текст
		// нарочно один и тот же.
		const roles = ALL_MARKS.filter((mark) => mark !== MERLIN_LIKE);
		roles.forEach((mark) => expect(roleHintText(mark, true)).not.toBe(roleHintText(mark, false)));
		expect(new Set(roles.map((mark) => roleHintText(mark, true))).size).toBe(roles.length);
	});

	test('чужой жетон не обращается к смотрящему на «ты»', () => {
		// Иначе на развязке чужая роль читалась бы как своя.
		expect(roleHintText(ESpecialRole.merlin, false)).not.toContain('Тебе');
		expect(roleHintText(ESpecialRole.assassin, false)).not.toContain('у тебя');
		expect(roleHintText(ESpecialRole.percival, false)).not.toContain('Тебе');
		expect(roleHintText(ESpecialRole.morgana, false)).not.toContain('Ты ');
	});

	test('свой жетон говорит, что делать прямо сейчас', () => {
		expect(roleHintText(ESpecialRole.merlin, true)).toContain('видно, кто шпион');
		expect(roleHintText(ESpecialRole.assassin, true)).toContain('один выстрел');
		expect(roleHintText(ESpecialRole.percival, true)).toContain('Морганой');
		expect(roleHintText(ESpecialRole.morgana, true)).toContain('Персиваль');
	});

	test('догадка Персиваля не называет, кто из двоих кто', () => {
		expect(roleHintText(MERLIN_LIKE, false)).toContain('Кто именно, тебе не сказали');
	});
});
