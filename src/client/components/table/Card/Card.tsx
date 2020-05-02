import React from 'react';
import './styles.scss';
import { observer } from "mobx-react-lite"
import {fulldeck, thingCard} from 'shared/constant/cards';
import {resources} from 'client/resources/resources';
import {EEventID} from 'shared/enum/cards';


interface ICardProps {
	id: string;
	menu?: React.ReactNode;
	onCardClick?: any;
	canBeUsed? :boolean;
}

const Card = observer(({id, menu, onCardClick, canBeUsed}: ICardProps) => {
	const card = fulldeck[id] || (id === EEventID.thing ? thingCard : null);
	if (!card) {
		console.error('Карты', id, 'не добавлено!');
		return null;
	}

	return (
		<div className={`cardWrapper ${canBeUsed ? 'cardCanBeUsed' : ''} ${card.id}`} >
			<div onClick={onCardClick} className={'card-clickable-zone'}></div>
			{menu && menu}
		</div>
	)
});

export default Card;
