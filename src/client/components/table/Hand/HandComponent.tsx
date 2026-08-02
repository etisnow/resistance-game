import {AnimatedPixi, getPixiTexture} from 'client/components/table/pixiInjected';
import React from 'react';
import { Container } from 'react-pixi-fiber';
import {clamp, map} from 'lodash';
import {observer} from "mobx-react-lite";
import {config, useTransition, interpolate} from 'react-spring/universal';
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
	const cardSelect = getPixiTexture(resources['cardSelect']);

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
			case EPlayerActionType.cardSelect:
				return <AnimatedPixi.Sprite
					{...commonSpriteProps}
					texture={cardSelect}
					y={interpolate([style.y, cardHeight], (y,h) => y + h * 0.36)}
					key={EPlayerActionType.cardTrade}
					pointerdown={() => onCardAction(uniqueId, EPlayerActionType.cardSelect)}
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

const HandComponent = observer(({cards, cardActions, selectedCardIndex, onSelectCard, onCardAction, y, autoWidth = false, enterFrom, exitTo} : IHandProps) => {

	const [hoveredCardId, setHoveredCardId] = React.useState<string | null>(null);

	if (!cards) return null;

	const cardsCount = Object.keys(cards).length;


	const cardNumberInRow = (card: ICardAny) => {
		return Object.values(cards).indexOf(card)
	};

	const hoveredCardNumber = hoveredCardId
		? Object.values(cards).findIndex(card => card.uniqueId === hoveredCardId)
		: -1;

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
			return isHovered ? applyHoverStyle(style, notificationHoverScale) : style;
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
							{...hoverHandlers(uniqueId)}
						/>
					</Container>
				)

			})}
		</Container>
	)
});

export default HandComponent;
