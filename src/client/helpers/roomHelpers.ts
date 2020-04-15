import {clamp} from 'lodash';
import {getWindowHeight, getWindowWidth} from 'client/helpers/window';


export const circRadius = (count) => {
	const rad = ((getWindowWidth() / 2) - (playerWidth(count) * 4))
	return clamp(rad, 0, getWindowHeight() / 6);
};
export const degToRag = (deg) => (deg * (Math.PI/180));
export const playerWidth = (count) => clamp((100 / count), 10, 15);
export const playerRoomDiag = (count) => (getWindowWidth() / (100/playerWidth(count)));
