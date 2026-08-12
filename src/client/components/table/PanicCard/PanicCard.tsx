import React from 'react';
import {observer} from "mobx-react-lite";
import * as PIXI from 'pixi.js';
import {Container} from 'react-pixi-fiber';
import {interpolate, useSpring} from 'react-spring/universal';
import GameController from 'client/controllers/gameController';
import {AnimatedPixi, getPixiTexture} from 'client/components/table/pixiInjected';
import {resources} from 'client/resources/resources';
import {cardAspectRatio} from 'shared/constant/cards';
import {tableCardPoint, tableCardTaper, tableSquash} from 'client/helpers/roomHelpers';
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
// А перевернувшись — встаёт: лежащая трапеция распрямляется в стоячую карту,
// разом теряя и сужение к дальнему краю, и сжатие по высоте (см. tableSquash и
// tableCardTaper), и заодно подрастает. Пауза перед подъёмом — чтобы движения
// не слились в одно: сначала все видят, ЧТО выпало, и только потом карта
// поднимается.
const risePauseMs = 140;
const riseDurationMs = 520;
// Во сколько раз вставшая карта крупнее лежавшей: её читают всем столом.
const riseScale = 1.18;

// Сама карта: монтируется на каждую новую панику, поэтому переворот играется
// ровно один раз — на появлении.
const PanicCardView = observer(({panicCard, place}: {panicCard: IFormatPanicCard, place: {x: number, y: number}}) => {
	// Полуоборот вокруг вертикальной оси: 0 — рубашка, 1 — лицо.
	const {flip} = useSpring<{flip: number}>({
		flip: 1,
		from: {flip: 0},
		delay: flipDelayMs,
		config: {duration: flipDurationMs},
	});

	// Подъём: 0 — карта лежит на столе в его проекции, 1 — стоит на нём прямо,
	// лицом к смотрящему.
	const {rise} = useSpring<{rise: number}>({
		rise: 1,
		from: {rise: 0},
		delay: flipDelayMs + flipDurationMs + risePauseMs,
		config: {duration: riseDurationMs},
	});

	const laidWidth = panicCardWidth();
	// Габариты по ходу подъёма: карта растёт, сжатие по высоте сходит на нет, и
	// сужение к дальнему краю распрямляется.
	const widthAt = (r: number) => laidWidth * (1 + (riseScale - 1) * r);
	const heightAt = (r: number) => widthAt(r) * cardAspectRatio * (tableSquash + (1 - tableSquash) * r);
	const taperAt = (r: number) => tableCardTaper + (1 - tableCardTaper) * r;

	// Рубашка сжимается к нулю, лицо из нуля разворачивается. Высота на середине
	// переворота чуть больше — так поворот читается объёмным, а не схлопыванием
	// картинки.
	const backWidth = interpolate([flip, rise], (v: number, r: number) =>
		Math.max(0, Math.cos(Math.PI * v)) * widthAt(r));
	const faceWidth = interpolate([flip, rise], (v: number, r: number) =>
		Math.max(0, -Math.cos(Math.PI * v)) * widthAt(r));
	const cardHeight = interpolate([flip, rise], (v: number, r: number) =>
		heightAt(r) * (1 + 0.12 * Math.sin(Math.PI * v)));
	const cardTaper = rise.interpolate((r: number) => taperAt(r));
	// Встаёт карта с того места, где лежала: нижняя кромка остаётся на столе, а
	// растёт она вверх. Иначе она не поднимается, а всплывает над столом.
	const cardY = rise.interpolate((r: number) =>
		tableCenterY() + place.y + (heightAt(0) - heightAt(r)) / 2);

	const commonProps = {
		x: tableCenterX() + place.x,
		y: cardY,
		height: cardHeight,
		taper: cardTaper,
		interactive: true,
		buttonMode: true,
		// Нажатие показывает карту крупно — тем же окошком-подсказкой, что и дверь
		// с карантином на столе.
		pointerdown: (event: PIXI.interaction.InteractionEvent) => toggleCardHintFor(panicCard.id, event),
	};

	return (
		<Container>
			{/* Выпадает паника той же трапецией, что и колода под ней (иначе рядом с
			    ней она бы разъехалась краями), а дальше распрямляется — и уже стоит
			    на столе обычной картой, которую видно целиком. */}
			<AnimatedPixi.PerspectiveTexture
				{...commonProps}
				texture={getPixiTexture(cardResources['panicBack'])}
				width={backWidth}
			/>
			<AnimatedPixi.PerspectiveTexture
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
	return (
		<PanicCardView
			key={panicCard.uniqueId || panicCard.id}
			panicCard={panicCard}
			place={tableCardPoint(controller.playersList.length)}
		/>
	);
});

export default PanicCard;
