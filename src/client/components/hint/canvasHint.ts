import * as PIXI from 'pixi.js';
import type {IHintAnchor} from 'client/components/hint/HoverHint';

// Мост между столом (канвас) и подсказками (DOM). Пикси-объект знает свои
// границы на канвасе, канвас знает своё место на странице — вместе это и есть
// якорь, к которому прижимается окошко.

const canvasOffset = () => {
	const canvas = document.querySelector('canvas.pixi-canvas');
	if (!canvas) return {left: 0, top: 0};
	const rect = canvas.getBoundingClientRect();
	return {left: rect.left, top: rect.top};
};

export const displayObjectAnchor = (target: PIXI.DisplayObject): IHintAnchor => {
	const bounds = target.getBounds();
	const {left, top} = canvasOffset();
	return {
		left: left + bounds.x,
		top: top + bounds.y,
		bottom: top + bounds.y + bounds.height,
		width: bounds.width,
	};
};
