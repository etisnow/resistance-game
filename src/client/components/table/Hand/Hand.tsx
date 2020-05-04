import {AnimatedPixi} from 'client/components/table/pixiInjected';
import React, {useEffect, useState} from 'react';
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
const Rect = CustomPIXIComponent(behavior, TYPE);


const generateCardMenu = (id, cardUniqueId, gameController: GameController, onSelectCard, card) => {
	const player = gameController.currentPlayer;
	if (!player || player.turnState === ETurnState.idle) return null;
	const menuItems = card.actions;
	if (menuItems.length === 0) return null;
	const menu = menuItems.map((menuIitem) => {
		switch (menuIitem.menuType) {
			case EPlayerActionType.cardAct:
				return <div
					key={EPlayerActionType.cardAct}
					className={'cardMenuItem'}
					onClick={() => handleCardAction(gameController, onSelectCard, EPlayerActionType.cardAct, cardUniqueId)}
				>
					Играть
				</div>;
			case EPlayerActionType.cardDiscard:
				return <div
					key={EPlayerActionType.cardDiscard}
					className={'cardMenuItem'}
					onClick={() => handleCardAction(gameController, onSelectCard, EPlayerActionType.cardDiscard, cardUniqueId)}
				>
					Сбросить
				</div>;
			case EPlayerActionType.cardTrade:
				return <div
					key={EPlayerActionType.cardTrade}
					className={'cardMenuItem'}
					onClick={() => handleCardAction(gameController, onSelectCard, EPlayerActionType.cardTrade, cardUniqueId)}
				>
					Обмен
				</div>;
		}
		return null;
	});
	return (
		<div className={'cardMenuWrapper'}>
			{menu}
		</div>
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
	return {x: x - width/2,y,angle:angleBetweenPointsDeg + 90, width}
}

const getCenterOffset = () => {
	const topPoint = getWindowHeight() - playerHandHeight()
	const YOffset = topPoint - (getWindowHeight() / 2)
	return YOffset
}

const calculateCardSelectedStypeProps = () => {
	const {width, height} = calculateSize();
	const offset = getCenterOffset() + (getCenterOffset() * 0.25)
	return {x:-width/2,y:-(offset + (height/2) ), angle:0, width}
}

const Hand = observer(({controller} : IHandProps) => {

	const [selectedCardIndex, selectCard] = useState(null);

	const player = controller.currentPlayer;
	if (!player) return null;
	const {hand} = player;
	if (!hand) return null;

	const cardsCount = hand.length;

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
		return hand.indexOf(card)
	};

	const styleUpdater = (card) => {
		const isSelected = card.uniqueId === selectedCardIndex;
		const cardNumber = cardNumberInRow(card);
		return isSelected ? calculateCardSelectedStypeProps() : calculateCardStypeProps(cardNumber, cardsCount)
	}
	const defaultCardStyle = { x:0,y:-getCenterOffset(),angle:-90, width: 0 };

	const transitions = useTransition(hand, card=>card.uniqueId, {
		from: defaultCardStyle,
		enter: styleUpdater,
		update: styleUpdater,
		leave: card => defaultCardStyle,
		config: config.default,
		native: true,
	} as any);

	const pivotAtCenter = {x:-getWindowWidth() / 2 , y: 0}

	return (
		<Container
			height={playerHandHeight()}
			width={getWindowWidth()}
			x={0}
			y={getWindowHeight() - playerHandHeight()}
			pivot={pivotAtCenter}
			mouseover={() => {console.log('test over')}}
		>
			{map(transitions, ({item: card, key, props}) => {
				const isSelected = selectedCardIndex === card.uniqueId;
				return (
					<AnimatedPixi.Container
						key={key}
						zIndex={isSelected ? 60 : 50}
					>
						<Card
							id={card.id}
							canBeUsed={true}
							onCardClick={() => cardSelection(card.uniqueId)}
							style={props}
						/>
					</AnimatedPixi.Container>
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
