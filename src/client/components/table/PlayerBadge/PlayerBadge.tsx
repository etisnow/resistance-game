import React from 'react';
import './styles.scss';
import {range, map} from 'lodash';
import { Container, Text, Graphics, Sprite } from 'react-pixi-fiber';
import Circle from 'client/components/pixiPrimitives/Circle';
import {resources} from 'client/resources/resources';
import * as PIXI from 'pixi.js'

interface IPlayerBadgeProps {
	id: string;
	nickname: string | null;
	color: string;
	inTurn: boolean;
	canBeSelected: boolean;
	isDoor: boolean;
	onSelect: ((playerId: string) => void) | null;
	quarantine: number;
	isYou: boolean;
	isInfected: boolean;
	isThing: boolean;
	isConnected: boolean;
	style: {
		width:number;
		height: number;
	}
}

const formatNickname = (nickname) => {
	if (!nickname) return null;
	return nickname.substring(0,4).toUpperCase()
};

const Quarantine = ({quarantine, badgeRadius}) => {
	const r = badgeRadius * 0.05;
	const yOffset = badgeRadius * 0.45;
	const xOffset = r * 4;
	return quarantine ? (
		<Container>
			{ map(range(quarantine), (q, index) => {
				return <Circle key={index} xCoord={(index * r * 4) - xOffset } yCoord={yOffset} color={0xFFFF00} r={r}/>
			})}
		</Container>
	) :  null;
}

const PlayerBadge = ({nickname, color, inTurn = false, canBeSelected = false, onSelect = null, id, isDoor, quarantine, isYou, isInfected, isThing, isConnected, style}: IPlayerBadgeProps) => {
	const nick = isYou ? 'ТЫ' : formatNickname(nickname)
	const playerBadgeTexture = PIXI.Texture.from(isDoor ? resources.playerBadges['door'] : resources.playerBadges[color]);
	const playerGlowTexture = PIXI.Texture.from(resources.playerbadgeGlow);
	const playerThingTexture = PIXI.Texture.from(resources.playerThing);
	const playerInfectedTexture = PIXI.Texture.from(resources.playerInfected);
	return (
		<Container

		>
			{canBeSelected && (
				<Sprite
					texture={playerGlowTexture}
					anchor={0.5}
					width={style.height * 1.35}
					height={style.height * 1.35}
				/>
			)}

			<Sprite
				texture={playerBadgeTexture}
				anchor={0.5}
				width={style.height}
				height={style.height}
				alpha={quarantine>0 ? 0.3 : 0.8}
				interactive={canBeSelected}
				buttonMode={canBeSelected}
				pointerdown={() => (onSelect && canBeSelected) ? onSelect(id) : null}
			/>
			{!isDoor && (
				<React.Fragment>
					<Text text={nick} anchor={0.5} style={{fontFamily : 'Arial', fontSize: 14, fill : 0xFFFFFF, align : 'center'}}/>
					{/*<Circle xCoord={0} yCoord={0} color={0xFF00FF} r={2}/>*/}
					<Quarantine quarantine={quarantine} badgeRadius={style.height/2} />
				</React.Fragment>
			)}
			{inTurn && (
				<Circle xCoord={0} yCoord={-style.height/2} color={0x00FF00} r={style.height * 0.07}/>
			)}
			{isThing && (
				<Sprite
					texture={playerThingTexture}
					anchor={0.5}
					y={style.height/2}
					width={style.height * 0.3}
					height={style.height * 0.3}
				/>
			)}
			{isInfected && (
				<Sprite
					texture={playerInfectedTexture}
					anchor={0.5}
					y={style.height/2}
					width={style.height * 0.2}
					height={style.height * 0.2}
				/>
			)}
		</Container>
	)
};

export default PlayerBadge;
