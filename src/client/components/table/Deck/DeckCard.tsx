import React from 'react';
import './styles.scss';
import {observer} from "mobx-react-lite";
import Card from 'client/components/table/Card/Card';
import {ECardType} from 'shared/enum/cards';

interface IDeckCardProps {
	type: ECardType;
}


const DeckCard = observer(({type}: IDeckCardProps) => {
	return (
		<div className={'deckCardWrapper'}>
			<Card id={type === ECardType.panic ? 'panic_back' : 'event_back'} />
		</div>
	)
});

export default DeckCard;
