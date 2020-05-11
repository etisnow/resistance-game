import React, {useEffect, useState} from 'react';
import './styles.scss';
import { observer } from "mobx-react-lite"
import {cardAspectRatio, fulldeck, thingCard} from 'shared/constant/cards';
import {resources} from 'client/resources/resources';
import {EEventID} from 'shared/enum/cards';
import { Container, Sprite } from 'react-pixi-fiber';
import * as PIXI from 'pixi.js'
import { AnimatedPixi } from '../pixiInjected';


interface ICardProps {
	id: string;
	menu?: (style:any) => React.ReactNode;
	onCardClick?: any;
	canBeUsed? :boolean;
	style: {
		width?: any;
		x?: any;
		y?: any;
		angle?: any;
	}
}

const Card = observer(({id, menu, onCardClick, canBeUsed, style}: ICardProps) => {
	const card = fulldeck[id] || (id === EEventID.thing ? thingCard : null);
	const cardTexture = PIXI.Texture.from(resources[id]);
	const glowTexture = PIXI.Texture.from(resources['glowEffect']);
	if (!card) {
		console.error('Карты', id, 'не добавлено!');
		return null;
	}

	const cardGlowWidth = style.width.interpolate ? style.width.interpolate(w=> w * 1.15) : style.width * 1.15
	const cardGlowHeight = style.width.interpolate ? style.width.interpolate(w=> w * cardAspectRatio * 1.1) : style.width * cardAspectRatio * 1.1

	const cardWidth = style.width.interpolate ? style.width.interpolate(w=> w) : style.width
	const cardHeight = style.width.interpolate ? style.width.interpolate(w=> w * cardAspectRatio) : style.width * cardAspectRatio

	return (
		<Container  >
			{canBeUsed && (
				<AnimatedPixi.Sprite
					texture={glowTexture}
					anchor={0.5}
					{...style}
					width={cardGlowWidth}
					height={cardGlowHeight}
				/>
			)}
			<AnimatedPixi.Sprite
				buttonMode
				interactive={!!onCardClick}
				texture={cardTexture}
				pointerdown={onCardClick}
				anchor={0.5}
				{...style}
				width={cardWidth}
				height={cardHeight}
			/>
			{menu && menu(style)}
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
