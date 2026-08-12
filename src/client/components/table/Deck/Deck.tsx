import React from 'react';
import {observer} from "mobx-react-lite";
import {cardAspectRatio} from 'shared/constant/cards';
import GameController from 'client/controllers/gameController';
import {deckCardWidth, tableCardPoint, tableCardTaper, tableTopSquash} from 'client/helpers/roomHelpers';
import {ECardType} from 'shared/enum/cards';
import {Container, Text} from 'react-pixi-fiber';
import PerspectiveTexture from 'client/components/pixiPrimitives/PerspectiveTexture';
import Trapezoid from 'client/components/pixiPrimitives/Trapezoid';
import {getPixiTexture} from 'client/components/table/pixiInjected';
import {resources} from 'client/resources/resources';
import {tableCenterX, tableCenterY} from 'client/helpers/window';
import {get, map, range} from 'lodash';
import {ENotificationAction} from 'shared/enum/notifications';

interface IDeckProps {
	controller: GameController
}


// Колода — стопка, а не одна карта: из-под верхней рубашки видно торцы тех, что
// под ней. Слои уходят вниз, к смотрящему: стол мы видим из-за его ближнего края.
//
// Стопка тает вместе с колодой: сколько карт осталось, видно, не читая счётчик.
// Полной считаем колоду примерно в fullDeckCards карт — столько их и раздают в
// начале партии; точного числа клиент не знает (оно зависит от состава), поэтому
// сверх него стопка просто не растёт.
const maxDeckLayers = 8;
const fullDeckCards = 50;
// Шаг между слоями в долях высоты лежащей карты и его нижняя граница в пикселях:
// на телефоне доля вырождается в ничто.
const layerStepShare = 0.03;
const layerStepMin = 1.5;
// Торцы карт: верхний слой почти как рубашка, нижний уходит в тень стола.
const layerTopColor = {r: 0x2a, g: 0x26, b: 0x22};
const layerBottomColor = {r: 0x08, g: 0x07, b: 0x06};

const deckBacks = {
	event: getPixiTexture(resources.eventBack),
	panic: getPixiTexture(resources.panicBack),
};
const deckGlowTexture = getPixiTexture(resources.glowEffect);
// Насколько подсветка «колоду можно взять» больше самой колоды.
const glowShare = 1.2;

// Тень колоды на столешнице. Стопка на столе лежит не плашмя — у неё есть
// высота (см. deckLayers), и свет в комнате падает сверху слева (тот же, что
// лепит кружки игроков), поэтому тень выходит из-под неё вправо и вниз.
//
// Двумя трапециями той же формы, что и сама колода: тень от карты — это карта,
// уроненная на стол. Одна пожиже и пошире, другая плотнее и по самой стопке, —
// у одной сплошной слишком резкий край, и она читается второй колодой.
//
// Сдвиг и разбег — в долях высоты лежащей карты.
const deckShadows = [
	{spread: 1.1, alpha: 0.26, shiftX: 0.16, shiftY: 0.12},
	{spread: 1, alpha: 0.34, shiftX: 0.09, shiftY: 0.07},
];

// react-pixi-fiber присваивает обработчик прямо в свойство объекта и снять его
// не умеет: prop со значением undefined он только сопровождает варнингом
// «ignoring prop», оставляя прежний колбэк. Поэтому обработчик передаём всегда
// определённым, а «колоду брать нельзя» — это пустой вызов (тот же приём, что и
// в Card).
const noop = () => {};

// Цвет торца по глубине слоя: 0 — сразу под верхней картой, 1 — самый низ стопки.
const layerColor = (depth: number): number => {
	const mix = (from: number, to: number) => Math.round(from + (to - from) * depth);
	return (mix(layerTopColor.r, layerBottomColor.r) << 16)
		+ (mix(layerTopColor.g, layerBottomColor.g) << 8)
		+ mix(layerTopColor.b, layerBottomColor.b);
};

// Слои стопки: от самого нижнего к верхнему — нижний рисуется первым, остальные
// его перекрывают, и наружу торчит только полоска торца каждого.
const deckLayers = (cardsLeft: number): {depth: number, step: number}[] => {
	const count = Math.min(maxDeckLayers, Math.round((cardsLeft / fullDeckCards) * maxDeckLayers));
	return map(range(count), (index) => ({
		depth: count > 1 ? (count - index) / count : 1,
		step: count - index,
	}));
};

const Deck = observer(({controller}: IDeckProps) => {
	const {playersList, deck} = controller;
	const width = deckCardWidth(playersList.length);
	// Колода лежит на столе, поэтому видна в проекции стола: по вертикали она
	// сжата ровно так же, как сама столешница (см. tableTopSquash).
	const height = width * cardAspectRatio * tableTopSquash;
	const layerStep = Math.max(layerStepMin, height * layerStepShare);
	const topCardType = deck.topCardType;
	// Пока на столе лежит сработавшая паника, колода закрыта — сначала все читают,
	// что случилось (см. PanicCard и gameController.cardPick).
	const inCardPick = get(controller, ['currentAction', 'type']) === ENotificationAction.cardPick
		&& !controller.panicCard;
	const fontSize = width/6
	// Колода лежит не в самой середине стола, а чуть глубже: у ближнего края
	// стоят игроки (см. tableCardPoint).
	const place = tableCardPoint(playersList.length);
	const layers = deckLayers(deck.count);
	// Низ стопки: от него и падает тень — стопка стоит на столе этим краем.
	const stackBottom = layerStep * layers.length;
	return (
		<Container x={tableCenterX() + place.x} y={tableCenterY() + place.y}>
			{/* Тень стопки на столешнице — до самой стопки: она под ней. */}
			{map(deckShadows, ({spread, alpha, shiftX, shiftY}) => (
				<Container key={spread} x={height * shiftX} y={stackBottom + height * shiftY}>
					<Trapezoid
						width={width * spread}
						height={height * spread}
						taper={tableCardTaper}
						color={0x000000}
						alpha={alpha}
					/>
				</Container>
			))}
			{/* Толщина стопки: рисуем её до верхней карты, из-под которой она и видна.
			    Торцы — той же трапеции, что и сама карта, иначе стопка расходится с
			    ней краями. */}
			{map(layers, ({depth, step}) => (
				<Trapezoid
					key={step}
					color={layerColor(depth)}
					yCoord={layerStep * step}
					width={width}
					height={height}
					taper={tableCardTaper}
				/>
			))}
			{/* Подсветка — той же трапецией, что и сама колода: прямоугольным ореолом
			    она торчала бы углами мимо её краёв. */}
			{inCardPick && (
				<PerspectiveTexture
					texture={deckGlowTexture}
					width={width * glowShare}
					height={height * glowShare}
					taper={tableCardTaper}
				/>
			)}
			{/* Верхняя карта колоды: лежит на столе, поэтому и нарисована лежащей —
			    сжатой по проекции стола и суженной к дальнему краю. */}
			<PerspectiveTexture
				texture={topCardType === ECardType.panic ? deckBacks.panic : deckBacks.event}
				width={width}
				height={height}
				taper={tableCardTaper}
				interactive={inCardPick}
				buttonMode={inCardPick}
				pointerdown={inCardPick ? () => {controller.cardPick()} : noop}
			/>
			{/* Сколько карт осталось — надпись на самой колоде, поэтому она лежит
			    вместе с ней и живёт по её сжатой высоте. */}
			<Text text={controller.deck.count+''} y={(height / 2) - fontSize * 0.8} anchor={0.5} style={{fontFamily : 'Arial', fontSize, fill : 0xFFFFFF}}/>
		</Container>
	)
});

export default Deck;
