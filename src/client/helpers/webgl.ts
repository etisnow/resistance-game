import * as PIXI from 'pixi.js';

// pixi.js (не -legacy) умеет рисовать только через WebGL: без него <Stage> не
// поднимется вовсе. Проверяем заранее, чтобы показать человеку внятную просьбу,
// а не пустой чёрный стол.
let supported: boolean | null = null;

export const isWebGLAvailable = (): boolean => {
	if (supported === null) {
		try {
			supported = PIXI.utils.isWebGLSupported();
		} catch {
			supported = false;
		}
	}
	return supported;
};
