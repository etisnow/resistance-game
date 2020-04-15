import React from 'react';
import './styles.scss';
import { observer } from "mobx-react-lite"
import {fulldeck} from 'shared/constant/cards';
import {resources} from 'client/resources/resources';


interface ICardProps {
	id: string;
	menu?: React.ReactNode;
	onCardClick?: any;
	canBeUsed? :boolean;
}

const Card = observer(({id, menu, onCardClick, canBeUsed}: ICardProps) => {
	const card = fulldeck[id];
	if (!card) {
		console.error('Карты', id, 'не добавлено!');
		return null;
	}

	return (
		<div className={`cardWrapper ${canBeUsed ? 'cardCanBeUsed' : ''}`}>
			<img src={resources[card.id]} alt={card.description} onClick={onCardClick}/>
			{menu && menu}
		</div>
	)
});

export default Card;
