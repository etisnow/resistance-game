import {clamp} from 'lodash';

export const getWindowHeight = () => {
	return clamp(window.innerHeight, 500, 700);
}

export const getWindowWidth = () => {
	return clamp(window.innerWidth, 320, 500);
}