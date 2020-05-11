import React from 'react';
import './styles.scss';
import {observer} from "mobx-react-lite";
import GameController from 'client/controllers/gameController';
import HandComponent from 'client/components/table/Hand/HandComponent';
import {getWindowHeight, playerHandHeight} from 'client/helpers/window';
interface IHandProps {
	controller: GameController
}

const Hand = observer(({controller} : IHandProps) => {

	const selectedCardIndex = controller.cardInPreview;
	const {currentPlayer:player, hand} = controller;
	if (!player || !hand) return null;

	const cardSelection = (index) => {
		if (selectedCardIndex === index) {
			controller.cardInPreview = null;
		} else {
			controller.cardInPreview = index;
		}
	};

	const handleCardAction = (cardUniqueId, cardAction) => {
		console.log({cardUniqueId, cardAction})
	}


	return (
		<HandComponent
			x={0}
			y={getWindowHeight() - playerHandHeight()}
			cards={hand}
			selectedCardIndex={selectedCardIndex}
			onSelectCard={cardSelection}
			cardActions={controller.handActions}
			onCardAction={handleCardAction}
		/>
	)
});

export default Hand;
