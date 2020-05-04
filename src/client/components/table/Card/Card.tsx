import React from 'react';
import './styles.scss';
import { observer } from "mobx-react-lite"
import {fulldeck, thingCard} from 'shared/constant/cards';
import {resources} from 'client/resources/resources';
import {EEventID} from 'shared/enum/cards';
import { Container, Sprite } from 'react-pixi-fiber';
import * as PIXI from 'pixi.js'
import { AnimatedPixi } from '../pixiInjected';


interface ICardProps {
	id: string;
	menu?: React.ReactNode;
	onCardClick?: any;
	canBeUsed? :boolean;
	style: {
		width?: number;
		height?: number;
		x?: number;
		y?: number;
		angle?: number;
	}
}

const Card = observer(({id, menu, onCardClick, canBeUsed, style}: ICardProps) => {
	const card = fulldeck[id] || (id === EEventID.thing ? thingCard : null);
	const cardTexture = PIXI.Texture.from(resources[id]);
	if (!card) {
		console.error('Карты', id, 'не добавлено!');
		return null;
	}

	return (
		<Container >
			<AnimatedPixi.Sprite
				texture={cardTexture}
				interactive
				pointerdown={onCardClick}
				buttonMode
				{...style}
			/>
		</Container>
	)
/*	return (
		<div className={`cardWrapper ${canBeUsed ? 'cardCanBeUsed' : ''} ${card.id}`} >
			<img src={resources[card.id]} onClick={onCardClick}/>
			{/!*<div onClick={onCardClick} className={'card-clickable-zone'}></div>*!/}
			{menu && menu}
		</div>
	)*/
});

export default Card;
