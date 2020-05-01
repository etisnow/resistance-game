import React, {useState} from 'react';
import {clamp, map} from 'lodash';
import './styles.scss';
import {observer} from "mobx-react-lite";
import {animated, interpolate, useTransition} from 'react-spring';
import GameController from 'client/controllers/gameController';
import {getWindowHeight, getWindowWidth} from 'client/helpers/window';
import {cardAspectRatio} from 'shared/constant/cards';
import Card from 'client/components/table/Card/Card';
import {ETurnState} from 'shared/enum/player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {degToRag} from 'client/helpers/roomHelpers';

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

const calculateScale = () => {
	const cardHeight = getWindowHeight() / playerHandHeight() ;
	const scale = cardHeight / cardAspectRatio;
	//const scale = getWindowHeight() / playerHandHeight();
	return scale * 0.85;
}

const calculateX = (cardNumber, cardsCount) => {
	const fullWidth = getWindowWidth() * 1
	const half = fullWidth / 2;
	console.log('card width', fullWidth,  cardsCount);
	const x = (fullWidth / cardsCount) * cardNumber;
	console.log(x)
	return x
}


/*GEOMETRY*/
const circleRadius = getWindowWidth()
const circleX = 0
const circleY = circleRadius - (getWindowHeight() * 0.06)

const getDegDeg = (cardNumber, cardsCount, maxDeg) => {
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
	const maxCardDeg = 50;
	const cardDeg = getDegDeg(cardNumber, cardsCount, maxCardDeg);
	const cardRotationDeg = getDegDeg(cardNumber, cardsCount, maxCardDeg * 0.4);
	const {x,y} = getCirclePoint(circleRadius, cardDeg, circleX,circleY);
	const {x: rorationXPoint,y: rotationYPoint} = getCirclePoint(circleRadius, cardRotationDeg, circleX,circleY);
	//const {ax, bx} = {x,y};
	//var angleBetweenPointsDeg = Math.atan2(circleY - y, circleX - x) * 180 / Math.PI;
	var angleBetweenPointsDeg = Math.atan2(rotationYPoint - circleY, rorationXPoint - circleX) * 180 / Math.PI;
	return {x,y,rot:angleBetweenPointsDeg + 90,scale:1}
}

const calculateCardSelectedStypeProps = () => {
	const scale = calculateScale();
	return {x:0,y:-(getWindowHeight() / 2 / scale) * 1,rot:0,scale}
}

const Hand = observer(({controller} : IHandProps) => {

	const [selectedCardIndex, selectCard] = useState(null);

	const player = controller.currentPlayer;
	if (!player) return null;
	const {hand} = player;
	if (!hand) return null;

	const cardsCount = hand.length;

	const cardSelection = (index) => {
		selectCard(index);
	};

	const onSelectCard = () => {
		selectCard(null)
	};

	const cardNumberInRow = (card) => {
		return hand.indexOf(card)
	};

	const transitions = useTransition(hand, card=>card.uniqueId, {
		from: {
				x:0,y:0,rot:0,scale:0
		},
		update: card => {
			const isSelected = card.uniqueId === selectedCardIndex;
			const cardNumber = cardNumberInRow(card);
			//const rot = isSelected ? 0 : cardNumber * (30 / cardsCount) - 15 + (15/cardsCount);
//
			//const scale = isSelected ? calculateScale(playerCardWidthPix()) : 1;
			//const y = isSelected ? -(getWindowHeight() * 0.03) : -(getWindowHeight() * 0.03);
			//const x = calculateX(cardNumberInRow(card), cardsCount);

			const {x,y,rot,scale} = isSelected ? calculateCardSelectedStypeProps() : calculateCardStypeProps(cardNumber, cardsCount)
			return {
				x,y,rot,scale
				//transform: `rotate(${rot}deg) scale(${scale}) translateY(${y}px) translateX(${x}px)`,
				//transform: `rotate(${rot}deg) scale(1) translateY(${y}px)`,
				//transformWrapper: `scale(${scale}) translateY(${y}px translateX(${x}px)`,
				//transformCard: `rotate(${rot}deg)`,
			};
		},
		leave: card => {
			return {
				x:0,y:0,rot:0,scale:0
				//transformWrapper: `rotate(90deg) scale(0) translateY(${-getWindowHeight()}px) translateX(0px)`,
				//transformCard: `rotate(0deg)`,
			};
		},
	} as any);

	return (
		<div className={"playerHand"} style={{height: playerHandHeight()}}>
			<div className={"playerHandInnerWrapper"} style={{height: playerHandHeight(), width: getWindowWidth()}}>
				{map(transitions, ({item: card, key, props}) => {
					const {x,y,rot,scale} = props as any;
					const {id} = card;
					const isSelected = selectedCardIndex === card.uniqueId;
					const cardMenu = generateCardMenu(id, card.uniqueId, controller, onSelectCard, card);
					return <animated.div
						key={key}
					    style={{
						    transform: interpolate([x,y,scale], (x1,y1,s1) => `scale(${s1}) translateY(${y1}px) translateX(${x1}px)`),
						    position: 'absolute',
						    display:'flex',
						    height: playerHandHeight(),
						    width: playerCardWidthPix() * 1.1,
						    zIndex: isSelected ? 60 : 50,
						    transformOrigin: `50% 50%`,
					    }}
					>
						<animated.div
							className={'rotationCardWrapper'}
						    style={{
							    transform: interpolate([rot], (r1) => `rotate(${r1}deg)`),
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
{/*			<svg height={circleRadius * 2} width={circleRadius * 2} style={{top: playerHandHeight() - circleRadius + circleY}}>
			  <circle cx={circleRadius} cy={circleRadius} r={circleRadius} stroke="black" stroke-width="0" fill="red" />
			</svg>*/}
		</div>
	)
});

export default Hand;

