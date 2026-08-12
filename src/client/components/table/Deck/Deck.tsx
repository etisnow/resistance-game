import React from 'react';
import {observer} from "mobx-react-lite";
import {cardAspectRatio} from 'shared/constant/cards';
import GameController from 'client/controllers/gameController';
import {deckCardWidth, tableCardPoint, tableSquash} from 'client/helpers/roomHelpers';
import {ECardType} from 'shared/enum/cards';
import {Container, Text} from 'react-pixi-fiber';
import RoundedRect from 'client/components/pixiPrimitives/RoundedRect';
import Card from 'client/components/table/Card/Card';
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
	// сжата ровно так же, как сама столешница (см. tableSquash).
	const height = width * cardAspectRatio * tableSquash;
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
	return (
		<Container x={tableCenterX() + place.x} y={tableCenterY() + place.y}>
			{/* Толщина стопки: рисуем её до верхней карты, из-под которой она и видна. */}
			{map(deckLayers(deck.count), ({depth, step}) => (
				<RoundedRect
					key={step}
					fill={layerColor(depth)}
					x={-width / 2}
					y={-height / 2 + layerStep * step}
					width={width}
					height={height}
					borderRadius={layerStep * 2}
				/>
			))}
			<Card
				id={topCardType === ECardType.panic ? 'panicBack' : 'eventBack'}
				canBeUsed={inCardPick}
				onCardClick={inCardPick ? () => {controller.cardPick()} : null}
				squash={tableSquash}
				style={{
					width,
					x:0,
					y:0,
					angle: 0
				}}
			/>
			{/* Сколько карт осталось — надпись на самой колоде, поэтому она лежит
			    вместе с ней и живёт по её сжатой высоте. */}
			<Text text={controller.deck.count+''} y={(height / 2) - fontSize * 0.8} anchor={0.5} style={{fontFamily : 'Arial', fontSize, fill : 0xFFFFFF}}/>
		</Container>
	)
});

export default Deck;
