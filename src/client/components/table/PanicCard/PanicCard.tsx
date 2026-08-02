import React from 'react';
import {observer} from "mobx-react-lite";
import * as PIXI from 'pixi.js';
import {Container} from 'react-pixi-fiber';
import {useSpring} from 'react-spring/universal';
import GameController from 'client/controllers/gameController';
import {AnimatedPixi, getPixiTexture} from 'client/components/table/pixiInjected';
import {resources} from 'client/resources/resources';
import {cardAspectRatio} from 'shared/constant/cards';
import {panicCardWidth, tableCenterX, tableCenterY} from 'client/helpers/window';
import {toggleCardHintFor} from 'client/components/hint/canvasHint';
import type {IFormatPanicCard} from 'shared/interfaces/common';

interface IPanicCardProps {
	controller: GameController
}

// resources — объектный литерал, у которого все карточные поля строковые
// (нестроковый там только вложенный playerBadges, за которым мы не ходим).
// Смотрим на него через строковый индекс, чтобы взять картинку по id карты.
const {playerBadges: _playerBadges, ...cardImages} = resources;
const cardResources: Record<string, string | undefined> = cardImages;

// Карта выходит на стол рубашкой вверх и тут же переворачивается лицом.
const flipDelayMs = 220;
const flipDurationMs = 480;

// Сама карта: монтируется на каждую новую панику, поэтому переворот играется
// ровно один раз — на появлении.
const PanicCardView = observer(({panicCard}: {panicCard: IFormatPanicCard}) => {
	// Полуоборот вокруг вертикальной оси: 0 — рубашка, 1 — лицо.
	const {flip} = useSpring<{flip: number}>({
		flip: 1,
		from: {flip: 0},
		delay: flipDelayMs,
		config: {duration: flipDurationMs},
	});

	const width = panicCardWidth();
	const height = width * cardAspectRatio;

	// Рубашка сжимается к нулю, лицо из нуля разворачивается. Высота на середине
	// чуть больше — так поворот читается объёмным, а не схлопыванием картинки.
	const backWidth = flip.interpolate((v: number) => Math.max(0, Math.cos(Math.PI * v)) * width);
	const faceWidth = flip.interpolate((v: number) => Math.max(0, -Math.cos(Math.PI * v)) * width);
	const cardHeight = flip.interpolate((v: number) => height * (1 + 0.12 * Math.sin(Math.PI * v)));

	const commonProps = {
		anchor: 0.5,
		x: tableCenterX(),
		y: tableCenterY(),
		height: cardHeight,
		interactive: true,
		buttonMode: true,
		// Нажатие показывает карту крупно — тем же окошком-подсказкой, что и дверь
		// с карантином на столе.
		pointerdown: (event: PIXI.interaction.InteractionEvent) => toggleCardHintFor(panicCard.id, event),
	};

	return (
		<Container>
			<AnimatedPixi.Sprite
				{...commonProps}
				texture={getPixiTexture(cardResources['panicBack'])}
				width={backWidth}
			/>
			<AnimatedPixi.Sprite
				{...commonProps}
				texture={getPixiTexture(cardResources[panicCard.id])}
				width={faceWidth}
			/>
		</Container>
	)
});

// Сработавшая паника лежит крупно в центре стола всё время своего события (и не
// меньше выдержки на чтение — см. gameController.syncPanicCard). Отдельного окна
// с паникой больше нет: пока карта здесь, колода закрыта.
const PanicCard = observer(({controller}: IPanicCardProps) => {
	const {panicCard} = controller;
	if (!panicCard) return null;
	// key — чтобы каждая новая паника монтировалась заново и переворачивалась.
	return <PanicCardView key={panicCard.uniqueId || panicCard.id} panicCard={panicCard}/>;
});

export default PanicCard;
