import {AnimatedPixi, getPixiTexture} from 'client/components/table/pixiInjected';
import React from 'react';
import * as PIXI from 'pixi.js';
import { Container, Sprite } from 'react-pixi-fiber';
import {clamp, includes, map} from 'lodash';
import {observer} from "mobx-react-lite";
import {config, useSpring, useTransition, interpolate} from 'react-spring/universal';
import type {AnimatedValue, UseTransitionProps} from 'react-spring/universal';
import {
	autoWidthCard,
	getWindowHeight,
	getWindowWidth,
	notificationCardGap,
	playerCardWidthPix,
	playerHandHeight,
	selectedNotificationCardScale,
} from 'client/helpers/window';
import {cardAspectRatio} from 'shared/constant/cards';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {degToRag} from 'client/helpers/roomHelpers';
import Card from '../Card/Card';
import {resources} from 'client/resources/resources';
import type {ICardAny} from 'shared/interfaces/cards';
import type {IHandActionsMap, IHandActionEntry} from 'client/controllers/socketTypes';

type ICardsMap = {[key: string]: ICardAny};

// The animated style object produced by react-spring's useTransition. Each key is an
// OpaqueInterpolation<number> which masquerades as a number and exposes `.interpolate`.
interface ICardStyleProps {
	x: number;
	y: number;
	angle: number;
	width: number;
}
type AnimatedCardStyle = AnimatedValue<ICardStyleProps>;

type OnSelectCard = (uniqueId: string) => void;
type OnCardAction = (uniqueId: string, action: EPlayerActionType) => void;

interface IHandProps {
	cards: ICardsMap;
	selectedCardIndex: null | string;
	cardActions: IHandActionsMap;
	onSelectCard: null | OnSelectCard;
	onCardAction: null | OnCardAction;
	y: number;
	autoWidth?: boolean;
	// Карты, отмеченные галочкой в окне множественного выбора: они помечены и
	// приподняты над остальными (см. notifier, ENotificationAction.selectCards).
	checkedCardIds?: string[];
	// Карты, которые въезжают в руку не «ниоткуда», а с конкретного места стола —
	// из колоды или из кружка отдавшего, — и то самое место.
	enterFrom?: ICardMoveStyle | null;
	// Карты, которые уходят из руки не в никуда, а в кружок получателя.
	exitTo?: ICardMoveStyle | null;
}

interface ICardMoveStyle {
	cardIds: string[];
	style: ICardStyleProps;
}


// Наведение имеет смысл только там, где есть курсор: на тач-экранах pointerover
// приходит вместе с тапом, и карта «залипала» бы в увеличенном виде.
const isHoverCapable = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
	? window.matchMedia('(hover: hover) and (pointer: fine)').matches
	: false;


const generateCardMenu = (card: ICardAny, cardActions: IHandActionsMap, onCardAction: OnCardAction) => (style: AnimatedCardStyle): React.ReactNode => {
	const uniqueId = card.uniqueId;
	if (!uniqueId) return null;
	const menuItems = cardActions[uniqueId];
	if (!menuItems || menuItems.length === 0) return null;
	//const player = gameController.currentPlayer;
	//if (!player || player.turnState === ETurnState.idle) return null;
	const cardAct = getPixiTexture(resources['cardAct']);
	const cardDiscard = getPixiTexture(resources['cardDiscard']);
	const cardTrade = getPixiTexture(resources['cardTrade']);

	const cardWidthPercent = 0.44
	const calcWidth = (w: number) => w * cardWidthPercent
	const calcXOffset = (w: number) => (w / 2 - calcWidth(w)) / 2

	const cardHeight = style.width.interpolate(w => w* cardAspectRatio)
	const width = style.width.interpolate(calcWidth)
	const buttonHeight = width.interpolate(w => w / 3.5)
	const commonSpriteProps = {
		width,
		interactive: true,
		buttonMode:true,
		height: buttonHeight,
		angle: style.angle,
	}
	const menu = menuItems.map((menuIitem: IHandActionEntry) => {

		const overrideStyles = menuItems.length === 1 ? {
			anchor: 0.5,
			x: interpolate([style.x, style.width], (x, _w) => x)
		} : {}


		switch (menuIitem.menuType) {
			case EPlayerActionType.cardAct:
				return <AnimatedPixi.Sprite
					{...commonSpriteProps}
					texture={cardAct}
					x={interpolate([style.x, style.width], (x,w) => x - calcWidth(w) - calcXOffset(w))}
					y={interpolate([style.y, cardHeight], (y,h) => y + h * 0.36)}
					key={EPlayerActionType.cardAct}
					pointerdown={() => onCardAction(uniqueId, EPlayerActionType.cardAct)}
					{...overrideStyles}
				/>
			case EPlayerActionType.cardDiscard:
				return <AnimatedPixi.Sprite
					{...commonSpriteProps}
					texture={cardDiscard}
					x={interpolate([style.x, style.width], (x,w) => x + calcXOffset(w))}
					y={interpolate([style.y, cardHeight], (y,h) => y + h * 0.36)}
					key={EPlayerActionType.cardDiscard}
					pointerdown={() => onCardAction(uniqueId, EPlayerActionType.cardDiscard)}
					{...overrideStyles}
				/>
			case EPlayerActionType.cardTrade:
				return <AnimatedPixi.Sprite
					{...commonSpriteProps}
					texture={cardTrade}
					x={interpolate([style.x, style.width], (x,w) => x + calcXOffset(w))}
					y={interpolate([style.y, cardHeight], (y,h) => y + h * 0.36)}
					key={EPlayerActionType.cardTrade}
					pointerdown={() => onCardAction(uniqueId, EPlayerActionType.cardTrade)}
					{...overrideStyles}
				/>
		}
		return null;
	});
	return (
		<Container>
			{menu}
		</Container>
	)
};

// Отметка выбранной карты — отпечаток пальца: карту «подписывают» пальцем, тем
// же неоново-зелёным, что и ладонь на кнопке OKAY. Палец коротко ведут по карте
// сверху вниз, оставляя за собой смазанный след, и прижимают; след с карты уже
// не сходит и после остановки ничем не отличается от того, что было в движении —
// он и рисуется-то один раз, просто проявляется по мере прохода пальца.
const fingerPrintAspect = 742 / 512;
// Ширина отпечатка в долях ширины карты: подпись, а не клякса во всю карту.
const stampWidth = 0.21;
// Длина мазка — доля высоты карты. Палец именно прикладывают, а не возят по
// столу: длинный проезд читается как прилетевшая откуда-то картинка.
const smearDistance = 0.05;
// Из скольких копий набран след. Их много и стоят они вплотную — так штука
// выглядит смазанной полосой, а не цепочкой отдельных отпечатков.
const smearTrail = 20;
// Самая дальняя копия настолько бледнее ближней.
const smearFarFade = 0.7;
// Общая плотность следа: копии складываются, поэтому каждая почти прозрачна. Но
// сама размазанная масса должна читаться — штрихи лежат поверх неё, а не вместо.
const smearAlpha = 0.12;
// Сколько штрихов краски тянется за пальцем и какого они цвета — тот же неон,
// что и сам отпечаток (см. Streaks).
const streakCount = 12;
const streakColor = 0x72ff00;
// Докуда достают полосы краски — в долях высоты самого оттиска: не дальше его
// собственной растворённой части, иначе они выглядят выехавшими на чистую карту.
const streakLength = 0.62;
// У каждой полосы два куска: чёткое начало у самого оттиска и размытый хвост
// дальше по мазку — краска сходит с пальца плотной чертой и растворяется.
const streakCoreShare = 0.35;
// Насколько полосы у краёв оттиска плотнее центральных: ребром палец давит
// сильнее, и краска оттуда сходит гуще.
const streakSideBoost = 0.5;
const streakCoreFilters = [(() => {
	const blur = new PIXI.filters.BlurFilter();
	blur.blurX = 0.15;
	blur.blurY = 0.6;
	return blur;
})()];
const streakTailFilters = [(() => {
	const blur = new PIXI.filters.BlurFilter();
	blur.blurX = 0.3;
	blur.blurY = 2;
	return blur;
})()];
// Смазан след по вертикали — вдоль движения пальца. Фильтр висит на всём слое
// следа сразу, а не на каждой копии: так это один проход рендера, а не двадцать.
const smearFilters = [(() => {
	const blur = new PIXI.filters.BlurFilter();
	blur.blurX = 1;
	blur.blurY = 14;
	return blur;
})()];

// Маска фейда: отпечаток растворяется в ту сторону, откуда пришёл палец. Делаем
// её процедурно — градиент по альфе, — и разворачиваем по направлению мазка, а не
// по оси отпечатка: наклон у штампа свой, а тает он всегда в шлейф.
let fadeTexture: PIXI.Texture | null = null;
const getFadeTexture = (): PIXI.Texture => {
	if (fadeTexture) return fadeTexture;
	const canvas = document.createElement('canvas');
	canvas.width = 4;
	canvas.height = 256;
	const ctx = canvas.getContext('2d');
	if (ctx) {
		const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
		gradient.addColorStop(0, 'rgba(255,255,255,0.08)');
		gradient.addColorStop(0.35, 'rgba(255,255,255,0.32)');
		gradient.addColorStop(0.7, 'rgba(255,255,255,0.74)');
		gradient.addColorStop(1, 'rgba(255,255,255,1)');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}
	fadeTexture = PIXI.Texture.from(canvas);
	return fadeTexture;
};

// Маска слоя полос: у самого оттиска их не видно (там всё закрывает краска под
// пальцем), сразу за ним они в полную силу и дальше по мазку сходят на нет. Без
// неё полосы просвечивают сквозь ту часть отпечатка, которую мы растворили.
let streakMaskTexture: PIXI.Texture | null = null;
const getStreakMaskTexture = (): PIXI.Texture => {
	if (streakMaskTexture) return streakMaskTexture;
	const canvas = document.createElement('canvas');
	canvas.width = 4;
	canvas.height = 256;
	const ctx = canvas.getContext('2d');
	if (ctx) {
		// Сверху вниз: дальний конец мазка → сам оттиск. У самого оттиска линий не
		// видно — там всё закрывает краска под пальцем, — они проявляются сразу за
		// его краем и сходят на нет к своему кончику.
		const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
		gradient.addColorStop(0, 'rgba(255,255,255,0.12)');
		gradient.addColorStop(0.3, 'rgba(255,255,255,1)');
		gradient.addColorStop(0.68, 'rgba(255,255,255,0.8)');
		gradient.addColorStop(0.9, 'rgba(255,255,255,0.18)');
		gradient.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}
	streakMaskTexture = PIXI.Texture.from(canvas);
	return streakMaskTexture;
};

// Один и тот же отпечаток у одной и той же карты: угол и наклон мазка считаем из
// её uniqueId, иначе штамп прыгал бы на каждой перерисовке. Хеш — FNV-1a с
// финальным перемешиванием: у карт подряд идущие id (card_112, card_113), и
// простая сумма давала им углы, отличающиеся на градус.
const seedOf = (value: string): number => {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i++) {
		hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
	}
	hash ^= hash >>> 15;
	hash = Math.imul(hash, 2246822507);
	hash ^= hash >>> 13;
	return Math.abs(hash | 0);
};

const FingerStamp = ({style, cardWidth, cardUniqueId}: {style: AnimatedCardStyle, cardWidth: number, cardUniqueId: string}) => {
	// Палец ведут по карте и прижимают: полсекунды — быстрее глаз не успевает
	// увидеть след, а отметка выглядит возникшей из ниоткуда.
	const {t} = useSpring<{t: number}>({t: 1, from: {t: 0}, config: {tension: 95, friction: 22}});
	// Маску назначаем объектом, поэтому её приходится сперва отрисовать и лишь
	// потом отдать отпечатку — отсюда состояние.
	const [fadeMask, setFadeMask] = React.useState<PIXI.Sprite | null>(null);
	const [streakMask, setStreakMask] = React.useState<PIXI.Sprite | null>(null);

	// Угол отпечатка и наклон мазка берём из разных концов хеша, иначе они ходили
	// бы парой и все отметки ложились бы одинаково. Ведут палец всегда сверху вниз
	// (с небольшим уклоном): вдоль этого же направления размазан и след.
	const seed = seedOf(cardUniqueId);
	const swipeDeg = 255 + (seed >>> 11) % 31;
	const swipeRad = degToRag(swipeDeg);
	// Наклон штампа свой у каждой карты и с мазком не связан: в какую сторону
	// отпечаток тает, решает маска фейда, а она развёрнута по движению.
	const stampAngle = (seed % 81) - 40;
	const swipe = cardWidth * cardAspectRatio * smearDistance;
	const swipeX = Math.cos(swipeRad) * swipe;
	const swipeY = Math.sin(swipeRad) * swipe;

	const width = cardWidth * stampWidth;
	const height = width * fingerPrintAspect;
	// Вся длина, на которую хватает полос: по ней же растянута их маска.
	const streakSpan = height * streakLength;
	// Пучок полос краски: у каждой своё место поперёк движения, свой отрезок пути
	// и своя плотность — палец пачкает бумагу неровно. Считаем из того же seed,
	// поэтому у карты он всегда один и тот же.
	const streaks = Array.from({length: streakCount}, (_, i) => {
		const noise = seedOf(`${cardUniqueId}:${i}`);
		// Все полосы выходят из-под оттиска: краска сползает с пальца, а не
		// начинается посреди карты.
		const from = 0;
		const offset = (((noise % 1000) / 1000) - 0.5) * width * 0.9;
		const side = Math.min(1, Math.abs(offset) / (width * 0.45));
		return {
			offset,
			from,
			to: 0.35 + ((noise >>> 3) % 100) / 100 * 0.65,
			thickness: width * (0.012 + ((noise >>> 17) % 100) / 100 * 0.026),
			alpha: (0.3 + ((noise >>> 23) % 100) / 100 * 0.4) * (1 - streakSideBoost + streakSideBoost * side),
		};
	});
	// Отпечаток лежит на нижней трети карты и целиком помещается на ней.
	const targetY = (y: number, w: number) => y + w * cardAspectRatio * 0.22;

	// Копия следа стоит там, где палец уже побывал: на доле k пути от конечной
	// точки к началу мазка. Она не едет — она проявляется в тот момент, когда
	// палец до неё дошёл, поэтому в конце движения след просто остаётся как есть.
	const smear = (index: number) => {
		const k = (index + 1) / smearTrail;
		const alpha = smearAlpha * (1 - k * smearFarFade);
		return (
			<AnimatedPixi.Sprite
				key={index}
				texture={getPixiTexture(resources.fingerPrint)}
				anchor={0.5}
				alpha={t.interpolate(p => alpha * clamp((p - (1 - k)) * 6, 0, 1))}
				angle={stampAngle}
				width={width}
				height={height}
				x={interpolate([style.x], (x: number) => x + swipeX * k)}
				y={interpolate([style.y, style.width], (y: number, w: number) => targetY(y, w) + swipeY * k)}
			/>
		);
	};

	return (
		<AnimatedPixi.Container interactiveChildren={false}>
			<AnimatedPixi.Container filters={smearFilters}>
				{Array.from({length: smearTrail}, (_, i) => smear(i))}
			</AnimatedPixi.Container>
			{/* Поверх смазанной массы — сами полосы краски, снятые пальцем с оттиска.
			    Слой повёрнут вдоль мазка, полосы внутри идут вверх по своей оси и
			    вытягиваются ровно на пройденное пальцем. Чёткие начала полос и их
			    размытые хвосты — разными слоями: у них разное размытие. */}
			{/* Маска слоя полос: живёт в тех же координатах, что и они, поэтому лежит
			    рядом — сдвинута от оттиска на половину своей длины вдоль мазка. */}
			<AnimatedPixi.Sprite
				ref={(sprite: PIXI.Sprite | null) => { if (sprite && sprite !== streakMask) setStreakMask(sprite); }}
				texture={getStreakMaskTexture()}
				anchor={0.5}
				angle={swipeDeg - 270}
				width={width * 3}
				height={streakSpan}
				x={interpolate([style.x], (x: number) => x + Math.cos(swipeRad) * streakSpan / 2)}
				y={interpolate([style.y, style.width], (y: number, w: number) => targetY(y, w) + Math.sin(swipeRad) * streakSpan / 2)}
			/>
			{[true, false].map(isCore => (
				<AnimatedPixi.Container
					key={isCore ? 'core' : 'tail'}
					filters={isCore ? streakCoreFilters : streakTailFilters}
					mask={streakMask ?? undefined}
					angle={(swipeRad * 180) / Math.PI + 90}
					x={style.x}
					y={interpolate([style.y, style.width], (y: number, w: number) => targetY(y, w))}
				>
					{streaks.map((streak, i) => {
						// Полоса живёт на отрезке [from, to] пути; ближняя к оттиску доля —
						// её чёткое начало, остальное уходит в размытый хвост.
						const edge = streak.from + (streak.to - streak.from) * streakCoreShare;
						const from = isCore ? streak.from : edge;
						const to = isCore ? edge : streak.to;
						// Видна полоса лишь настолько, насколько палец по ней уже проехал
						// (он идёт от 1 к 1 - p).
						const start = (p: number) => Math.max(from, 1 - p);
						const shown = (p: number) => Math.max(0, to - start(p));
						return (
							<AnimatedPixi.Sprite
								key={i}
								texture={PIXI.Texture.WHITE}
								tint={streakColor}
								anchor={0.5}
								alpha={isCore ? Math.min(1, streak.alpha * 1.6) : streak.alpha * 0.7}
								x={streak.offset}
								width={isCore ? streak.thickness : streak.thickness * 0.8}
								y={t.interpolate(p => -(start(p) + shown(p) / 2) * streakSpan)}
								height={t.interpolate(p => shown(p) * streakSpan)}
							/>
						);
					})}
				</AnimatedPixi.Container>
			))}
			{/* Сам оттиск: целиком его не видно никогда — со стороны, откуда пришёл
			    палец, он растворяется по градиентной маске. Маска едет вместе с ним в
			    общем контейнере и развёрнута по направлению мазка. */}
			<AnimatedPixi.Container
				x={interpolate([style.x, t], (x, p) => x + swipeX * (1 - p))}
				y={interpolate([style.y, style.width, t], (y, w, p) => targetY(y, w) + swipeY * (1 - p))}
			>
				<Sprite
					ref={(sprite: PIXI.Sprite | null) => { if (sprite && sprite !== fadeMask) setFadeMask(sprite); }}
					texture={getFadeTexture()}
					anchor={0.5}
					angle={swipeDeg - 270}
					width={height * 1.6}
					height={height * 1.6}
				/>
				<AnimatedPixi.Sprite
					texture={getPixiTexture(resources.fingerPrint)}
					mask={fadeMask ?? undefined}
					anchor={0.5}
					alpha={t.interpolate(p => Math.min(1, p * 1.6))}
					angle={stampAngle}
					width={width}
					height={height}
				/>
			</AnimatedPixi.Container>
		</AnimatedPixi.Container>
	);
};

const generateCheckBadge = (cardWidth: number, cardUniqueId: string) => (style: AnimatedCardStyle): React.ReactNode =>
	<FingerStamp style={style} cardWidth={cardWidth} cardUniqueId={cardUniqueId}/>;

// Веер руки лежит на дуге большого круга: чем больше радиус, тем более плоским
// получается веер. Это функции, а не константы модуля: посчитанные один раз при
// импорте, они держали веер в координатах самого первого кадра и после ресайза
// карты уезжали мимо экрана.
const fanRadius = () => clamp(getWindowWidth(), 200, 500)
const fanCenterX = 0
const fanCenterY = () => fanRadius() - (getWindowHeight() * 0.06)

// Ширина карты в руке.
const handCardWidth = () => playerCardWidthPix() * 1.1;

const calculateSize = () => {
	const width = Math.round(clamp(getWindowWidth() * 0.85, 0, 300));
	const height = Math.round(width * cardAspectRatio);
	return {width, height};
}

const getCardDeg = (cardNumber: number, cardsCount: number, maxDeg: number) => {
	const degDelta = maxDeg / cardsCount;
	const currentDeg = (degDelta * cardNumber) - 90 - (maxDeg / 2) + (degDelta / 2);
	return currentDeg;
}

const getCirclePoint = (radius: number, deg: number, centerX: number, centerY: number) => {
	const currentRad = degToRag(deg);
	const x = radius*Math.cos(currentRad) + centerX;
	const y = radius*Math.sin(currentRad) + centerY;
	return {x,y};
}


// indexShift сдвигает карту по той же дуге веера на доли «номера карты» — так
// соседи расступаются вокруг карты под курсором (см. hoverSpread), сохраняя
// правильный наклон.
const calculateCardStypeProps = (cardNumber: number, cardsCount: number, indexShift = 0): ICardStyleProps => {
	const degStep = 11;
	const maxCardDeg = degStep * cardsCount;
	const shiftedNumber = cardNumber + indexShift;
	const cardDeg = getCardDeg(shiftedNumber, cardsCount, maxCardDeg);
	const cardRotationDeg = getCardDeg(shiftedNumber, cardsCount, maxCardDeg * 0.5);
	const radius = fanRadius();
	const centerY = fanCenterY();
	const {x,y} = getCirclePoint(radius, cardDeg, fanCenterX, centerY);
	const {x: rotationXPoint,y: rotationYPoint} = getCirclePoint(radius, cardRotationDeg, fanCenterX, centerY);
	var angleBetweenPointsDeg = Math.atan2(rotationYPoint - centerY, rotationXPoint - fanCenterX) * 180 / Math.PI;

	const width = handCardWidth();

	return {x,y: y + playerHandHeight() * 0.65,angle:angleBetweenPointsDeg + 90, width}
}

// Ряд карт в окне выбора (упорство и прочие selectCard/okayCard): ровная строка
// без наклона и без наложения — в прежнем веере соседние карты закрывали
// центральную и выделить её было нечем.
const calculateNotificationCardStypeProps = (cardNumber: number, cardsCount: number): ICardStyleProps => {
	const width = autoWidthCard(cardsCount);
	const step = width * notificationCardGap;
	return {x: (cardNumber - (cardsCount - 1) / 2) * step, y: 0, angle: 0, width};
}

// Выбранная карта ряда остаётся на своём месте (видно, какую именно выбрали), но
// заметно вырастает и приподнимается над соседями.
const calculateNotificationSelectedStypeProps = (cardNumber: number, cardsCount: number): ICardStyleProps => {
	const base = calculateNotificationCardStypeProps(cardNumber, cardsCount);
	return {
		...base,
		y: base.y - base.width * cardAspectRatio * 0.1,
		width: base.width * selectedNotificationCardScale,
	};
}

const getCenterOffset = () => {
	const topPoint = getWindowHeight() - playerHandHeight()
	const YOffset = topPoint - (getWindowHeight() / 2)
	return YOffset - playerHandHeight() / 2
}

const calculateCardSelectedStypeProps = (): ICardStyleProps => {
	const {width} = calculateSize();
	const offset = getCenterOffset() + (getCenterOffset() * 0.25)
	return {x:0,y: -offset - (playerHandHeight() / 2), angle:0, width}
}

// Карта под курсором «вытаскивается» из руки: растёт, выпрямляется и
// приподнимается вдоль собственной оси. Подъём складывается из двух частей:
// половина прироста высоты (иначе нижняя кромка уехала бы вниз) плюс
// hoverExtraLiftFactor — на столько карта реально встаёт над рукой. На этот
// «лишний» подъём Card растягивает вниз невидимую ловушку наведения, чтобы карта
// не уезжала из-под курсора.
// В ряду выбора рост скромнее (карта не должна спорить с выбранной) и подъёма
// над соседями не нужно — там ряд ровный.
// Соседи при этом расступаются (в долях «номера карты» по дуге веера): выросшая
// карта иначе просто накрывает их, а поднимать её на целую высоту, чтобы она
// перестала мешать, — значит оторвать её от руки и закрыть ею колоду.
const hoverScale = 1.8;
const notificationHoverScale = 1.15;
// На сколько (в долях своей высоты) отмеченная галочкой карта встаёт над рядом.
const checkedCardLift = 0.1;
const hoverExtraLiftFactor = 0.3;
const hoverSpread = 0.75;

const handHoverPad = () => playerCardWidthPix() * 1.1 * cardAspectRatio * hoverExtraLiftFactor;

// Наклон веера гасим полностью: карта под курсором встаёт вертикально, поэтому и
// поднимаем её строго вверх (вдоль наклонной оси она бы уезжала вбок).
const applyHoverStyle = (style: ICardStyleProps, scale: number, extraLift = 0): ICardStyleProps => {
	const lift = style.width * cardAspectRatio * (scale - 1) / 2 + extraLift;
	return {
		x: style.x,
		y: style.y - lift,
		angle: 0,
		width: style.width * scale,
	};
}


// Путь карты между рукой и столом — та же пружина, что двигает карты в веере, но
// помягче: он длиннее любого движения внутри руки, и на общей жёсткости карта
// пролетала бы его рывком.
const tableFlightConfig = {tension: 120, friction: 26};

const HandComponent = observer(({cards, cardActions, selectedCardIndex, onSelectCard, onCardAction, y, autoWidth = false, checkedCardIds, enterFrom, exitTo} : IHandProps) => {

	const [hoveredCardId, setHoveredCardId] = React.useState<string | null>(null);

	if (!cards) return null;

	const cardsCount = Object.keys(cards).length;


	const cardNumberInRow = (card: ICardAny) => {
		return Object.values(cards).indexOf(card)
	};

	const hoveredCardNumber = hoveredCardId
		? Object.values(cards).findIndex(card => card.uniqueId === hoveredCardId)
		: -1;

	const isCardChecked = (card: ICardAny): boolean => !!card.uniqueId && includes(checkedCardIds, card.uniqueId);
	// Отметки живут только в ряду окна выбора — там ширина карты одна на всех.
	const checkedCardWidth = autoWidthCard(cardsCount);

	const styleUpdater = (card: ICardAny): ICardStyleProps => {
		const isSelected = card.uniqueId === selectedCardIndex;
		const isHovered = card.uniqueId === hoveredCardId;
		const cardNumber = cardNumberInRow(card);
		if (isSelected) {
			return autoWidth
				? calculateNotificationSelectedStypeProps(cardNumber, cardsCount)
				: calculateCardSelectedStypeProps();
		}
		if (autoWidth) {
			const style = calculateNotificationCardStypeProps(cardNumber, cardsCount);
			// Отмеченная карта приподнята над рядом: галочка на углу говорит, что
			// выбрано, а подъём — сколько именно, одним взглядом на весь ряд.
			const checkedStyle = isCardChecked(card)
				? {...style, y: style.y - style.width * cardAspectRatio * checkedCardLift}
				: style;
			return isHovered ? applyHoverStyle(checkedStyle, notificationHoverScale) : checkedStyle;
		}
		// Карты левее наведённой отъезжают влево, правее — вправо.
		const spread = (isHovered || hoveredCardNumber < 0)
			? 0
			: (cardNumber < hoveredCardNumber ? -hoverSpread : hoverSpread);
		const style = calculateCardStypeProps(cardNumber, cardsCount, spread);
		return isHovered ? applyHoverStyle(style, hoverScale, handHoverPad()) : style;
	}
	const defaultCardStyle: ICardStyleProps = { x:0,y:-getCenterOffset(),angle:-90, width: 0 };

	// Карта, приходящая в руку со стола, не появляется из ниоткуда, а уходящая не
	// тает на месте: это одна и та же карта, что лежала в колоде или в чужой руке,
	// и весь её путь — одно движение, а не «полёт по столу» плюс «появление в
	// руке». Соседи по вееру расступаются ей навстречу (и смыкаются вслед) своим
	// обычным update-переходом, так что гнездо готово с первого кадра.
	// В ряду выбора (упорство и прочие окна) стола нет — там лететь неоткуда.
	const moveStyle = (card: ICardAny, move: ICardMoveStyle | null | undefined): ICardStyleProps | null => {
		if (autoWidth || !move || !card.uniqueId) return null;
		return move.cardIds.includes(card.uniqueId) ? move.style : null;
	};


	// react-spring v8's useTransition typings demand the spring's target keys (x/y/angle/width)
	// at the top level via Merge<DS, ...>, but the runtime expects them only inside
	// from/enter/update/leave (top-level extras would be mis-read as additional springs).
	// We type the options object with the real UseTransitionProps and bridge that single
	// upstream typings flaw with a cast to the precise expected parameter shape.
	const transitionOptions: UseTransitionProps<ICardAny, ICardStyleProps> = {
		from: (card) => moveStyle(card, enterFrom) ?? defaultCardStyle,
		enter: styleUpdater,
		update: styleUpdater,
		leave: (card) => moveStyle(card, exitTo) ?? defaultCardStyle,
		config: (card) => moveStyle(card, enterFrom) || moveStyle(card, exitTo) ? tableFlightConfig : config.default,
	};
	const transitions = useTransition<ICardAny, ICardStyleProps>(
		Object.values(cards),
		card => card.uniqueId ?? '',
		transitionOptions as ICardStyleProps & UseTransitionProps<ICardAny, ICardStyleProps>,
	);

	const pivotAtCenter = {x:-getWindowWidth() / 2 , y: 0}

	// Обработчики наведения вешаем только на устройствах с курсором. Там же —
	// ловушка наведения под картой (в ряду выбора карта над соседями не встаёт,
	// значит и ловушка не нужна).
	const hoverHandlers = (uniqueId: string | null | undefined) => {
		if (!isHoverCapable || !uniqueId) return {};
		return {
			onCardOver: () => setHoveredCardId(uniqueId),
			onCardOut: () => setHoveredCardId(current => current === uniqueId ? null : current),
			hoverPad: autoWidth ? 0 : handHoverPad(),
		};
	};


	return (
		<Container
			y={y}
			pivot={pivotAtCenter}
			sortableChildren={true}
		>
			{map(transitions, ({item: card, key, props}) => {
				const uniqueId = card.uniqueId;
				const isSelected = selectedCardIndex === uniqueId;
				const isHovered = !isSelected && !!uniqueId && hoveredCardId === uniqueId;
				const cardActionEntries = uniqueId ? cardActions[uniqueId] : undefined;
				const canBeUsed = !!(cardActionEntries ? cardActionEntries.length : false)
				const cardMenu = onCardAction ? generateCardMenu(card, cardActions, onCardAction) : undefined;
				// Выбранная карта поверх всех, следом — карта под курсором,
				// остальные сохраняют порядок в руке.
				const zIndex = isSelected ? 60 : (isHovered ? 50 : cardNumberInRow(card));
				return (
					<Container key={key} zIndex={zIndex}>
						<Card
							id={card.id}
							canBeUsed={canBeUsed}
							onCardClick={() => { if (onSelectCard && uniqueId) onSelectCard(uniqueId) }}
							style={props}
							menu={isSelected ? cardMenu : undefined}
							badge={isCardChecked(card) && uniqueId ? generateCheckBadge(checkedCardWidth, uniqueId) : undefined}
							{...hoverHandlers(uniqueId)}
						/>
					</Container>
				)

			})}
		</Container>
	)
});

export default HandComponent;
