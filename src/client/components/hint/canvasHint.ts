import * as PIXI from 'pixi.js';
import {cardHintStore} from 'client/components/hint/cardHintStore';
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

// Нажали на то, что стол показывает вместо карты (дверь, отметки карантина) —
// показываем саму карту.
export const toggleCardHintFor = (cardId: string, event: PIXI.interaction.InteractionEvent) => {
	// Нажатие на подсказку — это только подсказка: до бейджа под ней (там
	// переключаются пометки игрока) оно доходить не должно.
	event.stopPropagation();
	cardHintStore.toggle(cardId, displayObjectAnchor(event.currentTarget));
};
