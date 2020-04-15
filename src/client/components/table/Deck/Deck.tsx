import React from 'react';
import './styles.scss';
import { observer } from "mobx-react-lite"
import {map, range} from 'lodash';
import {cardAspectRatio} from 'shared/constant/cards';
import DeckCard from 'client/components/table/Deck/DeckCard';
import GameController from 'client/controllers/gameController';
import {playerRoomDiag} from 'client/helpers/roomHelpers';
import {ECardType} from 'shared/enum/cards';

interface IDeckProps {
	controller: GameController
}


const Deck = observer(({controller}: IDeckProps) => {
	const {playersList, deck} = controller;
	const wrapperWidth = playerRoomDiag(playersList.length);
	const wrapperHeight = wrapperWidth * cardAspectRatio;
	const cardsCount = deck.count;
	const topCardType = deck.topCardType;
	return (
		<div className={'deckWrapper'} style={{width: `${wrapperWidth}px`, height: `${wrapperHeight}px`}}>
			{map(range(cardsCount-1), (index) => {
				const rotation = index ? index / 5 : 0;
				return (
					<div key={index} className={'deckCardWrapperMap'} style={{zIndex: index, transform: `rotate(${rotation}deg)`}}>
						<DeckCard type={ECardType.event}/>
					</div>
				)
			})}
			<div className={'deckCardWrapperMap'} style={{zIndex: cardsCount + 1}}>
				<DeckCard type={topCardType}/>
			</div>
		</div>
	)
});

export default Deck;
