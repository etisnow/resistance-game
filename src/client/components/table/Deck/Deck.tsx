import React from 'react';
import './styles.scss';
import {observer} from "mobx-react-lite";
import {cardAspectRatio} from 'shared/constant/cards';
import GameController from 'client/controllers/gameController';
import {playerRoomDiag} from 'client/helpers/roomHelpers';
import {ECardType} from 'shared/enum/cards';
import {Container, Text} from 'react-pixi-fiber';
import Card from 'client/components/table/Card/Card';
import {getWindowHeight, getWindowWidth} from 'client/helpers/window';
import {get} from 'lodash';
import {ENotificationAction} from 'shared/enum/notifications';

interface IDeckProps {
	controller: GameController
}


const Deck = observer(({controller}: IDeckProps) => {
	const {playersList, deck} = controller;
	const width = playerRoomDiag(playersList.length);
	const topCardType = deck.topCardType;
	const inCardPick = get(controller, ['currentAction', 'type']) === ENotificationAction.cardPick;
	const fontSize = width/6
	return (
		<Container x={getWindowWidth()/2} y={getWindowHeight()/2}>
			<Card
				id={topCardType === ECardType.panic ? 'panicBack' : 'eventBack'}
				canBeUsed={inCardPick}
				onCardClick={inCardPick ? () => {controller.cardPick()} : null}
				style={{
					width,
					x:0,
					y:0,
					angle: 0
				}}
			/>
			<Text text={controller.deck.count+''} y={(width * cardAspectRatio / 2) - fontSize} anchor={0.5} style={{fontFamily : 'Arial', fontSize, fill : 0xFFFFFF}}/>
		</Container>
	)
});

export default Deck;
