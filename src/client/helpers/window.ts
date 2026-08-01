import {clamp} from 'lodash';
import {cardAspectRatio, cardWidthPercent} from 'shared/constant/cards';

export const getConstrainedWindowHeight = () => {
	return clamp(window.innerHeight, 500, 1200);
}

export const getConstrainedWindowWidth = () => {
	return clamp(window.innerWidth, 320, 500);
}

export const getWindowHeight = () => {
	return window.innerHeight
}

export const getWindowWidth = () => {
	return window.innerWidth
}


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
