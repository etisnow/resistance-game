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




export const playerHandHeight = () => clamp((getWindowWidth() / (100/cardWidthPercent)) * cardAspectRatio, 50, getWindowHeight() / 5);
