import React, {useEffect, useState} from 'react';
import './styles.scss';
import { observer } from "mobx-react-lite"
import {cardAspectRatio, fulldeck, thingCard} from 'shared/constant/cards';
import {resources} from 'client/resources/resources';
import {EEventID} from 'shared/enum/cards';
import { Container, Sprite } from 'react-pixi-fiber';
import * as PIXI from 'pixi.js'
import { AnimatedPixi } from '../pixiInjected';
import {OutlineFilter} from '@pixi/filter-outline';
import {GlowFilter} from '@pixi/filter-glow';
import RoundedRect from 'client/components/pixiPrimitives/RoundedRect';
import {AdvancedBloomFilter} from '@pixi/filter-advanced-bloom';

interface ICardProps {
	id: string;
	menu?: React.ReactNode;
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
	const [cached, setCached] = useState(false);
	const card = fulldeck[id] || (id === EEventID.thing ? thingCard : null);
	const cardTexture = PIXI.Texture.from(resources[id]);
	if (!card) {
		console.error('Карты', id, 'не добавлено!');
		return null;
	}
	console.log(new OutlineFilter())

	const filter = new GlowFilter();
	filter.resolution = window.devicePixelRatio || 1;


	return (
		<Container  >

			<AnimatedPixi.Sprite
				buttonMode
				interactive
				filters={[filter]}
				
				texture={cardTexture}
				pointerdown={onCardClick}
				{...style}
				height={style.width.interpolate(w=> w * cardAspectRatio)}
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
