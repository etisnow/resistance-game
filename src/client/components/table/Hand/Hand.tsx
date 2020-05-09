import {AnimatedPixi} from 'client/components/table/pixiInjected';
import React, {useEffect, useLayoutEffect, useState} from 'react';
import { Container, Graphics, CustomPIXIComponent, Text } from 'react-pixi-fiber';
import {clamp, map} from 'lodash';
import './styles.scss';
import {observer} from "mobx-react-lite";
import {config, useTransition, interpolate} from 'react-spring/universal';
import GameController from 'client/controllers/gameController';
import {getWindowHeight, getWindowWidth} from 'client/helpers/window';
import {cardAspectRatio} from 'shared/constant/cards';
import {ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {degToRag} from 'client/helpers/roomHelpers';
import * as PIXI from 'pixi.js'
import Card from '../Card/Card';
import {resources} from 'client/resources/resources';
interface IHandProps {
	controller: GameController
}

const cardWidthPercent = 25;
const playerHandHeight = () => clamp((getWindowWidth() / (100/cardWidthPercent)) * cardAspectRatio, 50, getWindowHeight() / 5);
const playerCardWidthPix = () => playerHandHeight() / cardAspectRatio;

const handleCardAction = (gameController: GameController, onSelectCard, actionType: EPlayerActionType, cardUniqueId: string) => {
	gameController.cardAction(actionType, cardUniqueId);
	onSelectCard(actionType, cardUniqueId);
};


const TYPE = "Rectangle";
export const behavior = {
  customDisplayObject: props => new PIXI.Graphics(),
  customApplyProps: function(instance, oldProps, newProps) {
    const { fill, x, y, width, height } = newProps;
    instance.clear();
    instance.beginFill(fill);
    instance.drawRect(x, y, width, height);
    instance.endFill();
  }
};

const generateCardMenu = (card, gameController: GameController, onSelectCard) => (style) => {
	const menuItems = gameController.handActions[card.uniqueId];
	if (!menuItems || menuItems.length === 0) return null;
	const player = gameController.currentPlayer;
	if (!player || player.turnState === ETurnState.idle) return null;
	const cardAct = PIXI.Texture.from(resources['cardAct']);
	const cardDiscard = PIXI.Texture.from(resources['cardDiscard']);
	const cardTrade = PIXI.Texture.from(resources['cardTrade']);
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
					pointerdown={() => handleCardAction(gameController, onSelectCard, EPlayerActionType.cardAct, card.uniqueId)}
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
					pointerdown={(e) => {e.stopPropagation(); handleCardAction(gameController, onSelectCard, EPlayerActionType.cardDiscard, card.uniqueId)}}
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
					pointerdown={() => handleCardAction(gameController, onSelectCard, EPlayerActionType.cardTrade, card.uniqueId)}
				/>
		}
		return null;
	});
	return (
		<AnimatedPixi.Container>
			{menu}
		</AnimatedPixi.Container>
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

const Hand = observer(({controller} : IHandProps) => {


/*	useLayoutEffect(() => {
		console.log('hand', controller === olcontroler, controller, olcontroler)
		olcontroler = controller
	}, [controller])
	return*/

	const [selectedCardIndex, selectCard] = useState(null);

	const {currentPlayer:player, hand} = controller;
	if (!player || !hand) return null;

	const cardsCount = Object.keys(hand).length;


	const cardSelection = (index) => {
		if (selectedCardIndex === index) {
			selectCard(null)
		} else {
			selectCard(index);
		}
	};

	const onSelectCard = () => {
		selectCard(null)
	};

	const cardNumberInRow = (card) => {
		return Object.values(hand).indexOf(card)
	};

	const styleUpdater = (card) => {
		const isSelected = card.uniqueId === selectedCardIndex;
		const cardNumber = cardNumberInRow(card);
		return isSelected ? calculateCardSelectedStypeProps() : calculateCardStypeProps(cardNumber, cardsCount)
	}
	const defaultCardStyle = { x:0,y:-getCenterOffset(),angle:-90, width: 0 };


	const transitions = useTransition(Object.values(hand), card=>card.uniqueId, {
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
			x={0}
			y={getWindowHeight() - playerHandHeight()}
			pivot={pivotAtCenter}
			sortableChildren={true}
			mouseover={() => {console.log('test over')}}
		>
			{map(transitions, ({item: card, key, props}) => {
				const isSelected = selectedCardIndex === card.uniqueId;
				const canBeUsed = !!(controller.handActions[card.uniqueId] ? controller.handActions[card.uniqueId].length : false)
				const cardMenu = generateCardMenu(card, controller, onSelectCard);
				return (
					<Container key={key} zIndex={isSelected ? 60 : cardNumberInRow(card)}>
						<Card
							id={card.id}
							canBeUsed={canBeUsed}
							onCardClick={() => cardSelection(card.uniqueId)}
							style={props}
							menu={isSelected ? cardMenu : null}
						/>
					</Container>
				)

			})}
		</Container>
	)


/*	return (
		<div className={"playerHand"} style={{height: playerHandHeight()}}>
			<div className={"playerHandInnerWrapper"} style={{height: playerHandHeight(), width: getWindowWidth()}}>
				{map(transitions, ({item: card, key, props}) => {
					const {x,y,angle,width, height} = props as any;
					const {id} = card;
					const isSelected = selectedCardIndex === card.uniqueId;
					const cardMenu = generateCardMenu(id, card.uniqueId, controller, onSelectCard, card);
					return <animated.div
						key={key}
					    style={{
						    transform: interpolate([x,y], (x1,y1) => `translateY(${y1}px) translateX(${x1}px)`),
						    position: 'absolute',
						    display:'flex',
						    width,
						    height,
						    zIndex: isSelected ? 60 : 50,
						    transformOrigin: `50% 50%`,
					    }}
					>
						<animated.div
							className={'rotationCardWrapper'}
						    style={{
							    transform: interpolate([angle], (r1) => `rotate(${r1}deg)`),
							    transformOrigin: `50% 50%`,
						    }}
						>
							<Card
								key={card.id}
								id={id}
								onCardClick={() => cardSelection(card.uniqueId)}
								canBeUsed={!!cardMenu}
								menu={isSelected ? cardMenu : null}
							/>
						</animated.div>
					</animated.div>
				})}
				{selectedCardIndex !== null && <div onClick={() => cardSelection(null)} className={'cardsOverlay'}/>}
			</div>
		</div>
	)*/
});

export default Hand;
