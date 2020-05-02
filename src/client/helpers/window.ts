import {clamp} from 'lodash';

export const getWindowHeight = () => {
	return clamp(window.innerHeight, 500, 1200);
}

export const getWindowWidth = () => {
	return clamp(window.innerWidth, 320, 500);
}
