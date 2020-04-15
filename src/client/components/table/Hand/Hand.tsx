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
			rot: -20,
			y: 0,
			scale: 1,

		},
		enter: card => {
			const isSelected = card.uniqueId === selectedCardIndex;
			const rot = isSelected ? 0 : cardNumberInRow(card) * (180 / cardsCount) - 90 + (90/cardsCount);
			const scale = isSelected ? 2.5 : 1;
			const y = isSelected ? -90 : 0;
			return {
				rot,
				y,
				scale,
			}
		},
		update: card => {
			const isSelected = card.uniqueId === selectedCardIndex;
			const rot = isSelected ? 0 : cardNumberInRow(card) * (180 / cardsCount) - 90 + (90/cardsCount);
			const scale = isSelected ? 2.5 : 1;
			const y = isSelected ? -90 : 0;
			return {
				rot,
				y,
				scale,
			}
		},
		leave: card => {
			return {
				y: -getWindowHeight(),
				rot: 90,
				opacity:0,
				scale: 0
			}
		},
	} as any);
	return (
		<div className={"playerHand"} style={{height: playerHandHeight()}}>
			{map(transitions, ({item: card, key, props: {rot, scale, y}}) => {
				const {id} = card;
				const isSelected = selectedCardIndex === card.uniqueId;
				const cardMenu = generateCardMenu(id, card.uniqueId, controller, onSelectCard, card);
				return <animated.div
					key={key}
				    style={{
				        transform: interpolate([rot, scale, y], (rot, scale, y) => `rotate(${rot}deg) scale(${scale}) translateY(${y}px)`),
					    position: 'absolute',
					    display:'flex',
					    height: playerHandHeight(),
					    width: playerCardWidthPix(),
					    transformOrigin: '50% 110%',
					    zIndex: isSelected ? 60 : 50,
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
			})}
			{selectedCardIndex !== null && <div onClick={() => cardSelection(null)} className={'cardsOverlay'}/>}
		</div>
	)
});

export default Hand;

