import {ESpecialRole} from 'shared/enum/role';
import type Player from 'client/models/Player';

/**
 * Жетон роли на кружке: буква в цветном кружке рядом с личной пометкой.
 *
 * Жетоны есть только у особых ролей. Простой шпион и простой сопротивленец
 * обходятся без буквы — даже на развязке: сторону там называет кольцо по краю
 * кружка, и повторять его буквой значит писать на столе то, что уже написано.
 *
 * Жетонов на один больше, чем ролей: Персиваль видит Мерлина и Моргану одним и
 * тем же знаком — «М?». Он и правда не знает, кто из этих двоих кто, и стол
 * обязан показывать ему ровно то, что он знает, а не то, как есть на самом деле.
 */
export const MERLIN_LIKE = 'merlinLike';
export type TRoleMark = ESpecialRole | typeof MERLIN_LIKE;

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
};

/**
 * Каким жетоном отмечен этот игрок — с точки зрения того, кто на него смотрит.
 * Чего смотрящему знать не положено, до него и не доехало (см. formatPlayer), так
 * что здесь достаточно перебрать то, что пришло.
 *
 * Порядок важен: на развязке у Морганы приходит и настоящая роль, и «похожа на
 * Мерлина» — показать надо настоящую.
 */
export const roleMarkOf = (player: Player): TRoleMark | null => {
	if (player.isMerlin) return ESpecialRole.merlin;
	if (player.isMorgana) return ESpecialRole.morgana;
	if (player.isAssassin) return ESpecialRole.assassin;
	if (player.isPercival) return ESpecialRole.percival;
	if (player.looksLikeMerlin) return MERLIN_LIKE;
	return null;
};
