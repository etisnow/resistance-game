/**
 * Особые роли партии с Мерлином (см. Game.withMerlin, FR-14). Стороны за столом
 * по-прежнему две — это не третья сторона, а своё дело внутри своей.
 */
export enum ESpecialRole {
	merlin = 'merlin',
	assassin = 'assassin',
	// Персиваль и Моргана ходят только парой (см. Game.withPercival): Персиваль
	// видит Мерлина, а Моргана — то, из-за чего он в нём не уверен.
	percival = 'percival',
	morgana = 'morgana',
}

/**
 * Разбор дев-параметра `?activeRole=` — им в партии с ботами выдают роль себе
 * (см. GameServer.setupBotGame). Значение приходит из адресной строки, поэтому
 * нормализуем. «marlin» принимаем наравне с «merlin»: в этом слове ошибаются
 * чаще, чем стоит одна строка кода.
 */
export const parseDevRole = (requested?: string): ESpecialRole | null => {
	switch ((requested ?? '').trim().toLowerCase()) {
		case 'merlin':
		case 'marlin':
			return ESpecialRole.merlin;
		case 'assassin':
			return ESpecialRole.assassin;
		case 'percival':
			return ESpecialRole.percival;
		case 'morgana':
			return ESpecialRole.morgana;
		default:
			return null;
	}
};

/** Роли, которых нет без Персиваля с Морганой (см. Game.withPercival). */
export const isPercivalPairRole = (role: ESpecialRole): boolean =>
	role === ESpecialRole.percival || role === ESpecialRole.morgana;
