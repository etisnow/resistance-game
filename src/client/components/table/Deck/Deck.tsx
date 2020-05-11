import React from 'react';
import './styles.scss';
import { observer } from "mobx-react-lite"
import {cardAspectRatio} from 'shared/constant/cards';
import GameController from 'client/controllers/gameController';
import {playerRoomDiag} from 'client/helpers/roomHelpers';
import {ECardType} from 'shared/enum/cards';
import {Container, Text, Sprite} from 'react-pixi-fiber'
import Card from 'client/components/table/Card/Card';
import {getWindowHeight, getWindowWidth} from 'client/helpers/window';
import Circle from 'client/components/pixiPrimitives/Circle';
import {resources} from 'client/resources/resources';
import * as PIXI from 'pixi.js'
interface IDeckProps {
	controller: GameController
}


const Deck = observer(({controller}: IDeckProps) => {
	const {playersList, deck} = controller;
	const width = playerRoomDiag(playersList.length);
	const topCardType = deck.topCardType;
	console.log('DECK RENDERED', width)
	const cardHeight = width * cardAspectRatio;
	const deckCounterBgTexture = PIXI.Texture.from(resources.deckCounterBg)
	const counterBadgeSize = width/1.5;
	return (
		<Container x={getWindowWidth()/2} y={getWindowHeight()/2}>
			<Sprite texture={deckCounterBgTexture} x={0} y={-cardHeight/2} anchor={0.5} width={counterBadgeSize} height={counterBadgeSize}>
				<Text text={controller.deck.count+''} y={-counterBadgeSize * 0.8} anchor={0.5} style={{fontFamily : 'Arial', fontSize: counterBadgeSize/1.5, fill : 0xFFFFFF}}/>
			</Sprite>
			<Card
				id={topCardType === ECardType.panic ? 'panicBack' : 'eventBack'}
				canBeUsed={true}
				onCardClick={() => {console.log('deck card click')}}
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
