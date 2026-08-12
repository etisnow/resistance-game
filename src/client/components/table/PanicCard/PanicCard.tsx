import React from 'react';
import {observer} from "mobx-react-lite";
import * as PIXI from 'pixi.js';
import {interpolate, useSpring} from 'react-spring/universal';
import GameController from 'client/controllers/gameController';
import {AnimatedPixi, getPixiTexture} from 'client/components/table/pixiInjected';
import {resources} from 'client/resources/resources';
import {cardAspectRatio} from 'shared/constant/cards';
import {tableCardPoint, tableCardTaper, tableSquash} from 'client/helpers/roomHelpers';
import {getWindowHeight, getWindowWidth, panicCardWidth, tableCenterX, tableCenterY} from 'client/helpers/window';
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

// Отработав, паника уходит со стола в сброс: её отбрасывают вправо вниз, за
// край экрана, с переворотом через угол. Раньше она просто пропадала — событие
// кончалось, и карта исчезала посреди стола без всякого движения.
const tossMs = 380;
// Куда её уносит — в долях окна от места, где она стояла.
const tossXShare = 0.95;
const tossYShare = 0.4;
// На сколько она при этом закручивается и до какой доли своего размера успевает
// уменьшиться: улетая, карта разом и удаляется, и тает.
const tossAngle = 42;
const tossShrink = 0.45;

// Сама карта: монтируется на каждую новую панику, поэтому переворот играется
// ровно один раз — на появлении.
interface IPanicCardViewProps {
	panicCard: IFormatPanicCard;
	place: {x: number, y: number};
	// Событие карты кончилось: пора уходить в сброс.
	isLeaving: boolean;
}

const PanicCardView = observer(({panicCard, place, isLeaving}: IPanicCardViewProps) => {
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
	// Бросок в сброс: пока событие идёт — ноль, кончилось — единица.
	const {toss} = useSpring<{toss: number}>({
		toss: isLeaving ? 1 : 0,
		config: {duration: tossMs},
	});
	// Улетая, карта уменьшается — будто её отбросили от себя вглубь стола.
	const shrinkAt = (t: number) => 1 - (1 - tossShrink) * t;

	const backWidth = interpolate([flip, rise, toss], (v: number, r: number, t: number) =>
		Math.max(0, Math.cos(Math.PI * v)) * widthAt(r) * shrinkAt(t));
	const faceWidth = interpolate([flip, rise, toss], (v: number, r: number, t: number) =>
		Math.max(0, -Math.cos(Math.PI * v)) * widthAt(r) * shrinkAt(t));
	const cardHeight = interpolate([flip, rise, toss], (v: number, r: number, t: number) =>
		heightAt(r) * (1 + 0.12 * Math.sin(Math.PI * v)) * shrinkAt(t));
	const cardTaper = rise.interpolate((r: number) => taperAt(r));

	// Встаёт карта с того места, где лежала: нижняя кромка остаётся на столе, а
	// растёт она вверх. Иначе она не поднимается, а всплывает над столом. А уходя
	// — улетает от него же.
	const cardX = toss.interpolate((t: number) =>
		tableCenterX() + place.x + getWindowWidth() * tossXShare * t);
	const cardY = interpolate([rise, toss], (r: number, t: number) =>
		tableCenterY() + place.y + (heightAt(0) - heightAt(r)) / 2 + getWindowHeight() * tossYShare * t);

	const cardProps = {
		height: cardHeight,
		taper: cardTaper,
		// Улетающую карту не нажимают: она уже не на столе.
		interactive: !isLeaving,
		buttonMode: !isLeaving,
		// Нажатие показывает карту крупно — тем же окошком-подсказкой, что и дверь
		// с карантином на столе.
		pointerdown: (event: PIXI.interaction.InteractionEvent) => toggleCardHintFor(panicCard.id, event),
	};

	return (
		// Позиция, поворот и прозрачность — на контейнере: улетает карта целиком, а
		// не двумя своими сторонами по отдельности.
		<AnimatedPixi.Container
			x={cardX}
			y={cardY}
			angle={toss.interpolate((t: number) => tossAngle * t)}
			// Гаснет она не сразу и не в конце разом, а по всему пути — к концу
			// быстрее: так карта именно улетает, а не мигает напоследок.
			alpha={toss.interpolate((t: number) => 1 - t * t)}
		>
			{/* Выпадает паника той же трапецией, что и колода под ней (иначе рядом с
			    ней она бы разъехалась краями), а дальше распрямляется — и уже стоит
			    на столе обычной картой, которую видно целиком. */}
			<AnimatedPixi.PerspectiveTexture
				{...cardProps}
				texture={getPixiTexture(cardResources['panicBack'])}
				width={backWidth}
			/>
			<AnimatedPixi.PerspectiveTexture
				{...cardProps}
				texture={getPixiTexture(cardResources[panicCard.id])}
				width={faceWidth}
			/>
		</AnimatedPixi.Container>
	)
});

// Сработавшая паника лежит крупно в центре стола всё время своего события (и не
// меньше выдержки на чтение — см. gameController.syncPanicCard). Отдельного окна
// с паникой больше нет: пока карта здесь, колода закрыта.
const PanicCard = observer(({controller}: IPanicCardProps) => {
	const {panicCard} = controller;
	// Отработавшую карту держим на столе ещё на время броска: событие кончилось,
	// но карте надо успеть улететь в сброс.
	//
	// Держим её прямо здесь, в рендере, а не в состоянии по эффекту: на первом же
	// рендере без паники компонент снялся бы с дерева и вернулся бы уже новым —
	// с пружинами, начатыми заново, и с броском, который к первому своему кадру
	// уже кончился. Карта просто исчезала бы, только другим путём.
	const shown = React.useRef<IFormatPanicCard | null>(null);
	const [, redraw] = React.useReducer((tick: number) => tick + 1, 0);
	const tossTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	if (panicCard) shown.current = panicCard;
	const card = panicCard ?? shown.current;

	React.useEffect(() => {
		// Новая паника выходит на стол сама и старую с него сгоняет.
		if (panicCard) {
			if (tossTimer.current) clearTimeout(tossTimer.current);
			tossTimer.current = null;
			return;
		}
		if (!shown.current || tossTimer.current) return;
		tossTimer.current = setTimeout(() => {
			tossTimer.current = null;
			shown.current = null;
			redraw();
		}, tossMs);
	}, [panicCard]);
	React.useEffect(() => () => {
		if (tossTimer.current) clearTimeout(tossTimer.current);
	}, []);

	if (!card) return null;
	// key — чтобы каждая новая паника монтировалась заново и переворачивалась.
	return (
		<PanicCardView
			key={card.uniqueId || card.id}
			panicCard={card}
			place={tableCardPoint(controller.playersList.length)}
			isLeaving={!panicCard}
		/>
	);
});

export default PanicCard;
