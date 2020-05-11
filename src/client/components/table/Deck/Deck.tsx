import React from 'react';
import './styles.scss';
import {observer} from "mobx-react-lite";
import {cardAspectRatio} from 'shared/constant/cards';
import GameController from 'client/controllers/gameController';
import {playerRoomDiag} from 'client/helpers/roomHelpers';
import {ECardType} from 'shared/enum/cards';
import {Container, Sprite, Text} from 'react-pixi-fiber';
import Card from 'client/components/table/Card/Card';
import {getWindowHeight, getWindowWidth} from 'client/helpers/window';
import {resources} from 'client/resources/resources';
import * as PIXI from 'pixi.js';
import {ETurnState} from 'shared/enum/player';
import {get} from 'lodash';
import {ENotificationAction} from 'shared/enum/notifications';

interface IDeckProps {
	controller: GameController
}


const Deck = observer(({controller}: IDeckProps) => {
	const {playersList, deck} = controller;
	const width = playerRoomDiag(playersList.length);
	const topCardType = deck.topCardType;
	const cardHeight = width * cardAspectRatio;
	const deckCounterBgTexture = PIXI.Texture.from(resources.deckCounterBg)
	const counterBadgeSize = width/1.5;
	const inCardPick = get(controller, ['currentAction', 'type']) === ENotificationAction.cardPick;
	return (
		<Container x={getWindowWidth()/2} y={getWindowHeight()/2}>
			<Sprite texture={deckCounterBgTexture} x={0} y={-cardHeight/2} anchor={0.5} width={counterBadgeSize} height={counterBadgeSize}>
				<Text text={controller.deck.count+''} y={-counterBadgeSize * 0.8} anchor={0.5} style={{fontFamily : 'Arial', fontSize: counterBadgeSize/1.5, fill : 0xFFFFFF}}/>
			</Sprite>
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
		</Container>
	)
});

export default Deck;
