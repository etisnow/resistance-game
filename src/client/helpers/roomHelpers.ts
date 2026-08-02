import {clamp} from 'lodash';
import {tableField} from 'client/helpers/window';

// Доля свободного поля, которую оставляем по краям стола.
const roomMargin = 0.04;
// Насколько эллипс стола может быть вытянут. 1 — идеальный круг; небольшой
// запас позволяет занять чуть больше места на широком экране, но стол при этом
// всё ещё читается как круглый.
const maxRoomEccentricity = 1.2;
// Зазор между соседними бейджами: во сколько раз шаг по кругу больше диаметра.
const badgeGap = 1.35;
// Бейдж не крупнее половины полуоси стола — иначе кружки смыкаются в центре и
// стола как такового не видно.
const maxBadgeShare = 0.5;

// Габариты стола вместе с бейджами: половина свободного поля, ужатая до
// допустимой вытянутости.
const roomExtents = () => {
	const field = tableField();
	const availX = Math.max(0, (field.width / 2) * (1 - roomMargin));
	const availY = Math.max(0, (field.height / 2) * (1 - roomMargin));
	return {
		x: Math.min(availX, availY * maxRoomEccentricity),
		y: Math.min(availY, availX * maxRoomEccentricity),
	};
};

export const degToRag = (deg: number) => (deg * (Math.PI/180));

/**
 * Диаметр бейджа игрока.
 *
 * Раньше это был процент от короткой стороны окна: на телефоне выходило ~70 px —
 * мелко и неудобно попадать пальцем. Теперь бейдж настолько крупный, насколько
 * влезает: сверху его ограничивают либо шаг между соседями по кругу (чтобы
 * кружки не наезжали друг на друга), либо половина полуоси стола.
 */
export const playerRoomDiag = (count: number) => {
	const extents = roomExtents();
	// Тесно бейджам там, где стол уже — по малой полуоси, от неё и считаем.
	const minor = Math.min(extents.x, extents.y);
	// Шаг между соседями — хорда 2·R·sin(π/N), в неё должен влезть диаметр с
	// зазором. R здесь ещё неизвестен (он сам зависит от бейджа), поэтому
	// решаем d = 2·(minor − d/2)·share относительно d.
	const share = Math.sin(Math.PI / Math.max(count, 2)) / badgeGap;
	const bySpacing = (2 * minor * share) / (1 + share);
	return clamp(Math.min(bySpacing, minor * maxBadgeShare), 36, 220);
};

/**
 * Полуоси эллипса, по которому рассажены игроки: габариты стола минус радиус
 * самого бейджа. Раньше это был круг радиусом в 1/6 высоты окна — он не замечал
 * ни ширины экрана, ни того, сколько места занимают лог сверху и рука снизу.
 */
export const roomRadii = (count: number) => {
	const extents = roomExtents();
	const badgeRadius = playerRoomDiag(count) / 2;
	const rx = Math.max(0, extents.x - badgeRadius);
	const ry = Math.max(0, extents.y - badgeRadius);
	return {
		rx: Math.min(rx, ry * maxRoomEccentricity),
		ry: Math.min(ry, rx * maxRoomEccentricity),
	};
};

/**
 * Порядок игроков за столом. При «виде от игрока» список прокручен так, чтобы ты
 * сидел первым — то есть внизу, под своей рукой. Мертвец смотрит на стол сверху,
 * как он есть.
 *
 * Живёт здесь, а не в Room: по этому же кругу рука считает, откуда прилетает и
 * куда улетает карта обмена (см. Hand), а посчитанный второй раз он однажды со
 * столом разъедется.
 */
export const roomPlayerOrder = (playersList: string[], currentPlayerId: string, isSequential: boolean): string[] => {
	const index = playersList.indexOf(currentPlayerId);
	if (!isSequential || index < 0) return [...playersList];
	return [...playersList.slice(index), ...playersList.slice(0, index)];
};

/**
 * Место игрока за столом относительно его центра. Стол — эллипс: угол задаёт
 * место, а полуоси подогнаны под форму свободной области (см. roomRadii).
 * Отсчёт от +90°, поэтому первый в порядке сидит внизу.
 */
export const roomPlayerPoint = (playerId: string, playerOrder: string[]): {x: number, y: number} => {
	const deg = (360 / playerOrder.length) * playerOrder.indexOf(playerId) + 90;
	const rad = degToRag(deg);
	const {rx, ry} = roomRadii(playerOrder.length);
	return {x: rx * Math.cos(rad), y: ry * Math.sin(rad)};
};
