import React from 'react';
import './styles.scss';
import {observer} from "mobx-react-lite";
//import Card from 'client/components/table/Card/___Card';
import {ECardType} from 'shared/enum/cards';

interface IDeckCardProps {
	type: ECardType;
	width:number;
	height:number;
}


const DeckCard = observer(({type, width, height}: IDeckCardProps) => {
	return (
		<div className={'deckCardWrapper'}>
			{/*<Card id={type === ECardType.panic ? 'panicBack' : 'eventBack'} width={width} height={height}/>*/}
		</div>
	)
});

export default DeckCard;
