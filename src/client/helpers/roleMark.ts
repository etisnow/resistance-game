import {ESpecialRole} from 'shared/enum/role';
import type Player from 'client/models/Player';

/**
 * Жетон роли на кружке: буква в цветном кружке рядом с личной пометкой.
 *
 * Жетонов на один больше, чем ролей: Персиваль видит Мерлина и Моргану одним и
 * тем же знаком — «М?». Он и правда не знает, кто из этих двоих кто, и стол
 * обязан показывать ему ровно то, что он знает, а не то, как есть на самом деле.
 */
export const MERLIN_LIKE = 'merlinLike';
// Сторона без особой роли: обычный шпион и обычный сопротивленец. Эти два жетона
// зажигаются только на развязке (FR-10) — там роли открыты всем, и стол должен
// называть их вслух, а не одним лишь кольцом по краю кружка.
export const SPY_SIDE = 'spy';
export const RESISTANCE_SIDE = 'resistance';
export type TRoleMark = ESpecialRole | typeof MERLIN_LIKE | typeof SPY_SIDE | typeof RESISTANCE_SIDE;

interface IRoleMarkLook {
	// Буква на жетоне. Две — тоже буква: «МГ» у Морганы, чтобы не спорить с «М»
	// Мерлина, и «М?» у того, в ком Персиваль не уверен.
	text: string;
	fill: number;
	glyph: number;
}

// Цвет жетона — цвет стороны: золото у сопротивления, кровь у шпионов. Знак
// Персиваля — холодный: он ни то, ни другое, а догадка.
const merlinGold = 0xE8C33F;
const spyBlood = 0x8E2B22;
const guessSteel = 0x9FB6C4;
const darkGlyph = 0x241A05;
const lightGlyph = 0xFFFFFF;

export const ROLE_MARK_LOOK: {[key in TRoleMark]: IRoleMarkLook} = {
	[ESpecialRole.merlin]: {text: 'М', fill: merlinGold, glyph: darkGlyph},
	[ESpecialRole.assassin]: {text: 'У', fill: spyBlood, glyph: lightGlyph},
	[ESpecialRole.percival]: {text: 'П', fill: guessSteel, glyph: darkGlyph},
	[ESpecialRole.morgana]: {text: 'МГ', fill: spyBlood, glyph: lightGlyph},
	[MERLIN_LIKE]: {text: 'М?', fill: guessSteel, glyph: darkGlyph},
	// Своего цвета этим двоим не нужно: цвет здесь и есть сторона, а больше о них
	// сказать нечего — тем они от особых ролей и отличаются.
	[SPY_SIDE]: {text: 'Ш', fill: spyBlood, glyph: lightGlyph},
	[RESISTANCE_SIDE]: {text: 'С', fill: merlinGold, glyph: darkGlyph},
};

/**
 * Каким жетоном отмечен этот игрок — с точки зрения того, кто на него смотрит.
 * Чего смотрящему знать не положено, до него и не доехало (см. formatPlayer), так
 * что здесь достаточно перебрать то, что пришло.
 *
 * Порядок важен: на развязке у Морганы приходит и настоящая роль, и «похожа на
 * Мерлина» — показать надо настоящую. Простая сторона идёт последней: особая роль
 * и так говорит, за кого он играл.
 *
 * isRevealed — партия кончена и роли открыты (round.isRolesRevealed). До этого
 * простую сторону жетоном не показываем: пока идёт игра, знают её единицы —
 * шпионы про своих да Мерлин про всех, — и буква на кружке говорила бы им то, что
 * они и так знают, зато на развязке перестала бы читаться как новость.
 */
export const roleMarkOf = (player: Player, isRevealed: boolean): TRoleMark | null => {
	if (player.isMerlin) return ESpecialRole.merlin;
	if (player.isMorgana) return ESpecialRole.morgana;
	if (player.isAssassin) return ESpecialRole.assassin;
	if (player.isPercival) return ESpecialRole.percival;
	if (player.looksLikeMerlin) return MERLIN_LIKE;
	if (isRevealed && player.isSpy !== null) return player.isSpy ? SPY_SIDE : RESISTANCE_SIDE;
	return null;
};
