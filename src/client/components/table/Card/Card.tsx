import React from 'react';
import { observer } from "mobx-react-lite"
import {cardAspectRatio, fulldeck, thingCard} from 'shared/constant/cards';
import {resources} from 'client/resources/resources';
import {EEventID} from 'shared/enum/cards';
import { Container } from 'react-pixi-fiber';
import type {AnimatedValue, OpaqueInterpolation} from 'react-spring/universal';
import {AnimatedPixi, getPixiTexture} from '../pixiInjected';

// The animated style object produced by react-spring's useTransition in HandComponent.
// Each key is an OpaqueInterpolation<number> which masquerades as a number and exposes
// `.interpolate`.
interface ICardStyleProps {
	x: number;
	y: number;
	angle: number;
	width: number;
}
type AnimatedCardStyle = AnimatedValue<ICardStyleProps>;
// HandComponent passes an animated (interpolated) style; Deck passes a static numeric
// style. Card supports both: each width access checks for `.interpolate` at runtime.
type CardStyle = AnimatedCardStyle | ICardStyleProps;

interface ICardProps {
	id: string;
	onCardClick?: (() => void) | null;
	canBeUsed?: boolean;
	style: CardStyle;
	// The `menu` renderer is only supplied by HandComponent, which always pairs it with
	// an animated style; the static-style caller (Deck) never passes a menu.
	menu?: (style: AnimatedCardStyle) => React.ReactNode;
}

// A style is "animated" when its values expose react-spring's `.interpolate`.
const isAnimatedStyle = (style: CardStyle): style is AnimatedCardStyle =>
	typeof (style.width as OpaqueInterpolation<number>)?.interpolate === 'function';

// resources is an object literal whose card-image entries are all `string` (only the
// unrelated nested `playerBadges` entry is non-string, and it is never looked up here).
// We view it through a string index signature so a card image can be looked up by an
// arbitrary `id`, yielding `string | undefined` under noUncheckedIndexedAccess.
const {playerBadges: _playerBadges, ...cardImages} = resources;
const cardResources: Record<string, string | undefined> = cardImages;

const Card = observer(({id, menu, onCardClick, canBeUsed, style}: ICardProps) => {
	const card = fulldeck[id] || (id === EEventID.thing ? thingCard : null);
	const cardTexture = getPixiTexture(cardResources[id]);
	const glowTexture = getPixiTexture(cardResources['glowEffect']);
	if (!card) {
		console.error('Карты', id, 'не добавлено!');
		return null;
	}
	const cardGlowWidth = isAnimatedStyle(style) ? style.width.interpolate(w => w * 1.15) : style.width * 1.15
	const cardGlowHeight = isAnimatedStyle(style) ? style.width.interpolate(w => w * cardAspectRatio * 1.1) : style.width * cardAspectRatio * 1.1
	const cardWidth = isAnimatedStyle(style) ? style.width.interpolate(w => w) : style.width
	const cardHeight = isAnimatedStyle(style) ? style.width.interpolate(w => w * cardAspectRatio) : style.width * cardAspectRatio

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
				buttonMode={true}
				interactive={true}
				texture={cardTexture}
				pointerdown={onCardClick ?? undefined}
				anchor={0.5}
				{...style}
				width={cardWidth}
				height={cardHeight}
			/>
			{menu && isAnimatedStyle(style) && (
				<React.Fragment>
					{menu(style)}
				</React.Fragment>
			)}
		</Container>
	)
});

export default Card;
