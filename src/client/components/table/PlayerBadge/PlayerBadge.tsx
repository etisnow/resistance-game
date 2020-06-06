import React, {useCallback, useEffect, useState} from 'react';
import {map, range} from 'lodash';
import {Container, Sprite, Text} from 'react-pixi-fiber';
import Circle from 'client/components/pixiPrimitives/Circle';
import {resources} from 'client/resources/resources';
import {getPixiTexture} from 'client/components/table/pixiInjected';
import {EPlayerMark} from 'shared/enum/playerMarks';

interface IPlayerBadgeProps {
	id: string;
	nickname: string | null;
	color: string;
	inTurn: boolean;
	canBeSelected: boolean;
	isDoor: boolean;
	onSelect: ((playerId: string) => void) | null;
	onLongPress: ((playerId: string) => void) | null;
	quarantine: number;
	isYou: boolean;
	isInfected: boolean;
	isThing: boolean;
	isConnected: boolean;
	mark: EPlayerMark | undefined;
	style: {
		width:number;
		height: number;
	}
}


const playerGlowTexture = getPixiTexture(resources.playerbadgeGlow);
const playerThingTexture = getPixiTexture(resources.playerThing);
const playerInfectedTexture = getPixiTexture(resources.playerInfected);
/*Marks*/
const playerStatusQuestion = getPixiTexture(resources.playerStatusQuestion);
const playerStatusThing = getPixiTexture(resources.playerStatusThing);
const playerStatusInfected = getPixiTexture(resources.playerStatusInfected);
const playerStatusClear = getPixiTexture(resources.playerStatusClear);

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

const getMarkTexture = (mark: EPlayerMark | undefined) => {
	switch (mark) {
		case EPlayerMark.question:
			return playerStatusQuestion;
		case EPlayerMark.infected:
			return playerStatusInfected;
		case EPlayerMark.thing:
			return playerStatusThing;
		case EPlayerMark.clear:
			return playerStatusClear;
	}
}

function useLongPress(callback = () => {}, ms = 700) {
	const [startLongPress, setStartLongPress] = useState(false);

	useEffect(() => {
		let timerId;
		if (startLongPress) {
			timerId = setTimeout(callback, ms);
		} else {
			clearTimeout(timerId);
		}
		return () => {
			clearTimeout(timerId);
		};
	}, [callback, ms, startLongPress]);

	const start = useCallback(() => {
		setStartLongPress(true);
	}, []);
	const stop = useCallback(() => {
		setStartLongPress(false);
	}, []);

	return {
		interactive: true,
		buttonMode: true,
		pointerdown: start,
		pointerup: stop,
	};
}

const PlayerBadge = ({
		nickname,
		color,
		inTurn = false,
		canBeSelected = false,
		onSelect = null,
		id,
		isDoor,
		quarantine,
		isYou,
		isInfected,
		isThing,
		isConnected,
		style,
		onLongPress = null,
		mark,
	}: IPlayerBadgeProps) => {
	const playerBadgeTexture = getPixiTexture(isDoor ? resources.playerBadges['door'] : isConnected ? resources.playerBadges[color] : resources.playerBadges['disconnected']);
/*	const longPress = useLongPress(() => {
	});*/
	const markPlayer = () => {
		if (canBeSelected || isYou) return;
		onLongPress && onLongPress(id);
	}

	if (!color && !isDoor) return null;
	const nick = isYou ? 'ТЫ' : formatNickname(nickname)
	return (
		<Container pointerdown={markPlayer} buttonMode={true} interactive={true}>
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
				alpha={quarantine>0 ? 0.4 : 1}
				interactive={canBeSelected}
				buttonMode={canBeSelected}
				pointerdown={() => (onSelect && canBeSelected) ? onSelect(id) : null}
			/>
			{!isDoor && (
				<React.Fragment>
					<Text text={nick} anchor={0.5} style={{fontFamily : 'Arial', fontSize: 14, fill : 0xFFFFFF, align : 'center'}}/>
					<Quarantine quarantine={quarantine} badgeRadius={style.height/2} />
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
					{(mark && mark !==EPlayerMark.none) && (
						<Sprite
							texture={getMarkTexture(mark)}
							anchor={0.5}
							y={-style.height/4}
							width={style.height * 0.2}
							height={style.height * 0.2}
						/>
					)}
				</React.Fragment>
			)}
		</Container>
	)
};

export default PlayerBadge;
