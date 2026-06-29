import {clamp} from 'lodash';
import {getConstrainedWindowWidth, getWindowHeight, getWindowWidth} from 'client/helpers/window';


export const circRadius = (count: number) => {
	const rad = ((getWindowWidth() / 2) - (playerWidth(count) * 4))
	return clamp(rad, 0, getWindowHeight() / 6);
};
export const degToRag = (deg: number) => (deg * (Math.PI/180));
export const playerWidth = (count: number) => clamp((100 / count), 10, 15);
export const playerRoomDiag = (count: number) => (getConstrainedWindowWidth() / (100/playerWidth(count)));
