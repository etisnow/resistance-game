import {clamp} from 'lodash';
import {sceneSide, tableField} from 'client/helpers/window';

// Поля вокруг стола, чтобы бейджи не липли к кромкам экрана.
const roomMargin = 0.02;
// Насколько эллипс стола может быть вытянут. Без ограничения на ультравайде
// игроки растянулись бы в линию через весь экран.
const maxRoomEccentricity = 1.8;

/**
 * Полуоси эллипса, по которому рассажены игроки.
 *
 * Раньше это был круг радиусом в 1/6 высоты окна: он не замечал ни ширины
 * экрана, ни того, сколько места занимают лог сверху и рука снизу, — на широком
 * мониторе стол оставался пятачком в центре пустого поля. Теперь стол
 * растягивается по обеим осям свободной области.
 */
export const roomRadii = (count: number) => {
	const badgeRadius = playerRoomDiag(count) / 2;
	const field = tableField();
	const byWidth = Math.max(0, (field.width / 2) - badgeRadius - (field.width * roomMargin));
	const byHeight = Math.max(0, (field.height / 2) - badgeRadius - (field.height * roomMargin));
	return {
		rx: Math.min(byWidth, byHeight * maxRoomEccentricity),
		ry: Math.min(byHeight, byWidth * maxRoomEccentricity),
	};
};
export const degToRag = (deg: number) => (deg * (Math.PI/180));
export const playerWidth = (count: number) => clamp((100 / count), 10, 15);
export const playerRoomDiag = (count: number) => (sceneSide() / (100/playerWidth(count)));
