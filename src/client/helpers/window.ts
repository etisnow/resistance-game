import {clamp} from 'lodash';
import {cardAspectRatio, cardWidthPercent} from 'shared/constant/cards';
import {viewport} from 'client/helpers/viewport';

// Размер сцены, а не окна: канвас живёт в своём контейнере и следит за ним
// (см. viewport). Значения observable — компоненты стола пересчитывают
// координаты сами, как только окно меняется.
export const getWindowHeight = () => viewport.height;

export const getWindowWidth = () => viewport.width;

// Базовый масштаб стола: от него считается всё, что должно расти вместе с окном
// (бейджи игроков, колода). Берём короткую сторону — стол занимает обе оси
// сразу, поэтому смотреть только на ширину нельзя, в ландшафте место
// заканчивается по высоте. Раньше базой была ширина, зажатая в 320–500 px, и на
// широком мониторе бейджи оставались размером с мобильные.
export const sceneSide = () => clamp(Math.min(getWindowWidth(), getWindowHeight()), 320, 1080);

// Сверху стол перекрыт DOM-оверлеями (лог и бейдж текущего действия — они
// висят на 2% и 9% высоты), снизу — рукой. Свободное поле между ними и есть та
// область, в которую надо вписывать круг игроков.
const topOverlayHeight = () => getWindowHeight() * 0.09 + 36;

// Веер приподнимает крайние карты над номинальной полосой руки, поэтому места
// под неё резервируем с запасом — иначе нижний игрок оказывается под картами.
const handReservedHeight = () => playerHandHeight() * 1.15;

export const tableField = () => {
	const top = topOverlayHeight();
	const bottom = getWindowHeight() - handReservedHeight();
	return {top, bottom, width: getWindowWidth(), height: Math.max(0, bottom - top)};
};

// Центр стола — середина свободного поля, а не окна: раньше круг игроков был
// прибит к центру экрана, из-за чего сверху его резал лог, а снизу подпирали
// карты руки.
export const tableCenterX = () => getWindowWidth() / 2;
export const tableCenterY = () => {
	const {top, bottom} = tableField();
	return (top + bottom) / 2;
};


// Карты в окнах выбора (упорство, «посмотри вокруг» и т.п.) лежат ровным рядом.
// Ширину считаем так, чтобы весь ряд с зазорами влез по ширине экрана, а
// увеличенная выбранная карта — по высоте. Иначе карты наезжают друг на друга и
// выбранную (особенно центральную) не отличить от соседних.
export const notificationCardGap = 1.12;
export const selectedNotificationCardScale = 1.3;

export const autoWidthCard = (cardsCount: number) => {
	const byWidth = (getWindowWidth() * 0.94) / Math.max(cardsCount, 1) / notificationCardGap;
	const byHeight = (getWindowHeight() * 0.5) / (cardAspectRatio * selectedNotificationCardScale);
	return clamp(Math.min(byWidth, byHeight), 80, 260);
}
export const playerCardWidthPix = () => playerHandHeight() / cardAspectRatio;
export const playerHandHeight = () => clamp((getWindowWidth() / (100/cardWidthPercent)) * cardAspectRatio, 50, getWindowHeight() / 5);
