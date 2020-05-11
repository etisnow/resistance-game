import {AnimatedPixi, getPixiTexture} from 'client/components/table/pixiInjected';
import React, {useEffect, useLayoutEffect, useState} from 'react';
import { Container, Graphics, CustomPIXIComponent, Text } from 'react-pixi-fiber';
import {clamp, map} from 'lodash';
import './styles.scss';
import {observer} from "mobx-react-lite";
import {config, useTransition, interpolate} from 'react-spring/universal';
import GameController from 'client/controllers/gameController';
import {getWindowHeight, getWindowWidth, playerHandHeight} from 'client/helpers/window';
import {cardAspectRatio} from 'shared/constant/cards';
import {ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {degToRag} from 'client/helpers/roomHelpers';
import * as PIXI from 'pixi.js'
import Card from '../Card/Card';
import {resources} from 'client/resources/resources';
import gameController from 'client/controllers/gameController';
import {ICardEvent} from 'shared/interfaces/cards';

interface IHandProps {
	cards: {[key:string]: ICardEvent};
	selectedCardIndex: null | string;
	cardActions: {[key: string]: any[] };
	onSelectCard: null| Function;
	onCardAction: null| Function;
	x: number;
	y: number;
}



const playerCardWidthPix = () => playerHandHeight() / cardAspectRatio;

const generateCardMenu = (card, cardActions, onCardAction) => (style) => {
	const menuItems = cardActions[card.uniqueId];
	if (!menuItems || menuItems.length === 0) return null;
	//const player = gameController.currentPlayer;
	//if (!player || player.turnState === ETurnState.idle) return null;
	const cardAct = getPixiTexture(resources['cardAct']);
	const cardDiscard = getPixiTexture(resources['cardDiscard']);
	const cardTrade = getPixiTexture(resources['cardTrade']);
	const cardHeight = style.width.interpolate(w => w* cardAspectRatio)
	const width = style.width.interpolate(w => w/2)
	const buttonHeight = width.interpolate(w => w * 1.2343)
	const menu = menuItems.map((menuIitem) => {
		switch (menuIitem.menuType) {
			case EPlayerActionType.cardAct:
				return <AnimatedPixi.Sprite
					interactive={true}
					texture={cardAct}
					width={width}
					height={buttonHeight}
					x={interpolate([style.x, style.width], (x,w) => x - w/2)}
					y={interpolate([style.y, cardHeight], (y,h) => y + h * 0.1)}
					angle={style.angle}
					key={EPlayerActionType.cardAct}
					pointerdown={() => onCardAction(card.uniqueId, EPlayerActionType.cardAct)}
				/>
			case EPlayerActionType.cardDiscard:
				return <AnimatedPixi.Sprite
					interactive={true}
					texture={cardDiscard}
					width={width}
					height={buttonHeight}
					x={interpolate([style.x, style.width], (x,w) => x)}
					y={interpolate([style.y, cardHeight], (y,h) => y + h * 0.1)}
					angle={style.angle}
					key={EPlayerActionType.cardDiscard}
					pointerdown={() => onCardAction(card.uniqueId, EPlayerActionType.cardDiscard)}
				/>
			case EPlayerActionType.cardTrade:
				return <AnimatedPixi.Sprite
					interactive={true}
					texture={cardTrade}
					width={width}
					height={buttonHeight}
					x={interpolate([style.x, style.width], (x,w) => x )}
					y={interpolate([style.y, cardHeight], (y,h) => y + h * 0.1)}
					angle={style.angle}
					key={EPlayerActionType.cardTrade}
					pointerdown={() => onCardAction(card.uniqueId, EPlayerActionType.cardTrade)}
				/>
			case EPlayerActionType.cardSelect:
				return <AnimatedPixi.Sprite
					interactive={true}
					texture={cardTrade}
					width={width}
					height={buttonHeight}
					x={interpolate([style.x, style.width], (x,w) => x )}
					y={interpolate([style.y, cardHeight], (y,h) => y + h * 0.1)}
					angle={style.angle}
					key={EPlayerActionType.cardTrade}
					pointerdown={() => onCardAction(card.uniqueId, EPlayerActionType.cardSelect)}
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

const circleRadius = clamp(getWindowWidth(), 200, 500)
const circleX = 0
const circleY = circleRadius - (getWindowHeight() * 0.06)

const calculateSize = () => {
	const width = Math.round(clamp(getWindowWidth() * 0.85, 0, 300));
	const height = Math.round(width * cardAspectRatio);
	return {width, height};
}

const getCardDeg = (cardNumber, cardsCount, maxDeg) => {
	const degDelta = maxDeg / cardsCount;
	const currentDeg = (degDelta * cardNumber) - 90 - (maxDeg / 2) + (degDelta / 2);
	return currentDeg;
}

const getCirclePoint = (radius, deg, centerX, centerY) => {
	const currentRad = degToRag(deg);
	const x = radius*Math.cos(currentRad) + centerX;
	const y = radius*Math.sin(currentRad) + centerY;
	return {x,y};
}


const calculateCardStypeProps = (cardNumber, cardsCount) => {
	const degStep = 11;
	const maxCardDeg = degStep * cardsCount;
	const cardDeg = getCardDeg(cardNumber, cardsCount, maxCardDeg);
	const cardRotationDeg = getCardDeg(cardNumber, cardsCount, maxCardDeg * 0.5);
	const {x,y} = getCirclePoint(circleRadius, cardDeg, circleX,circleY);
	const {x: rotationXPoint,y: rotationYPoint} = getCirclePoint(circleRadius, cardRotationDeg, circleX,circleY);
	var angleBetweenPointsDeg = Math.atan2(rotationYPoint - circleY, rotationXPoint - circleX) * 180 / Math.PI;
	const width = (playerCardWidthPix() * 1.1 );
	return {x,y: y + playerHandHeight() * 0.65,angle:angleBetweenPointsDeg + 90, width}
}

const getCenterOffset = () => {
	const topPoint = getWindowHeight() - playerHandHeight()
	const YOffset = topPoint - (getWindowHeight() / 2)
	return YOffset - playerHandHeight() / 2
}

const calculateCardSelectedStypeProps = () => {
	const {width, height} = calculateSize();
	const offset = getCenterOffset() + (getCenterOffset() * 0.25)
	return {x:0,y: -offset - (playerHandHeight() / 2), angle:0, width}
}

let olhand = null

const HandComponent = observer(({cards, cardActions, selectedCardIndex, onSelectCard, onCardAction, x, y} : IHandProps) => {

	if (!cards) return null;

	const cardsCount = Object.keys(cards).length;


	const cardNumberInRow = (card) => {
		return Object.values(cards).indexOf(card)
	};

	const styleUpdater = (card) => {
		const isSelected = card.uniqueId === selectedCardIndex;
		const cardNumber = cardNumberInRow(card);
		return isSelected ? calculateCardSelectedStypeProps() : calculateCardStypeProps(cardNumber, cardsCount)
	}
	const defaultCardStyle = { x:0,y:-getCenterOffset(),angle:-90, width: 0 };


	const transitions = useTransition(Object.values(cards), card=>card.uniqueId, {
		from: defaultCardStyle,
		enter: (card) => {console.log('enter'); return styleUpdater(card)},
		update: (card) => {console.log('update'); return styleUpdater(card)},
		leave: card => {console.log('LEAVE'); return defaultCardStyle},
		config: config.default,
		native: true,
	} as any);

	const pivotAtCenter = {x:-getWindowWidth() / 2 , y: 0}



	return (
		<Container
			x={x}
			y={y}
			pivot={pivotAtCenter}
			sortableChildren={true}
			mouseover={() => {console.log('test over')}}
		>
			{map(transitions, ({item: card, key, props}) => {
				const isSelected = selectedCardIndex === card.uniqueId;
				const canBeUsed = !!(cardActions[card.uniqueId] ? cardActions[card.uniqueId].length : false)
				const cardMenu = generateCardMenu(card, cardActions, onCardAction);
				return (
					<Container key={key} zIndex={isSelected ? 60 : cardNumberInRow(card)}>
						<Card
							id={card.id}
							canBeUsed={canBeUsed}
							onCardClick={() => onSelectCard(card.uniqueId)}
							style={props}
							menu={isSelected ? cardMenu : null}
						/>
					</Container>
				)

			})}
		</Container>
	)
});

export default HandComponent;
