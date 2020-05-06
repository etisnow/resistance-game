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
	const glowTexture = PIXI.Texture.from(resources['glowEffect']);
	if (!card) {
		console.error('Карты', id, 'не добавлено!');
		return null;
	}


	return (
		<Container  >
			{canBeUsed && (
				<AnimatedPixi.Sprite
					texture={glowTexture}
					{...style}
					width={style.width.interpolate(w=> w * 1.15)}
					height={style.width.interpolate(w=> w * cardAspectRatio * 1.1)}
					anchor={0.5}
				/>
			)}
			<AnimatedPixi.Sprite
				buttonMode
				interactive
				texture={cardTexture}
				pointerdown={onCardClick}
				{...style}
				height={style.width.interpolate(w=> w * cardAspectRatio)}
				anchor={0.5}
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
