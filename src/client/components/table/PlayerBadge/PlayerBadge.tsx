import React from 'react';
import './styles.scss';
import cx from 'classnames';
import {range, map} from 'lodash';
import { Container, Text, Graphics } from 'react-pixi-fiber';
import Circle from 'client/components/pixiPrimitives/Circle';


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

const TurnBadge = () => {
	return <div className={'turnBadge'}/>
};

const InfectBadge = () => {
	return <div className={'infectBadge'}/>
};
const ThingBadge = () => {
	return <div className={'thingBadge'}/>
};
const Quarantine = ({quarantine}) => {
	return quarantine ? (
		<div className={'quarantineBadge'}>
			{ map(range(quarantine), (q) => <div key={q} className={'quarantineDot'}/>) }
		</div>
	) :  null;
}

const PlayerBadge = ({nickname, color, inTurn = false, canBeSelected = false, onSelect = null, id, isDoor, quarantine, isYou, isInfected, isThing, isConnected, style}: IPlayerBadgeProps) => {
	const nick = isYou ? 'ТЫ' : formatNickname(nickname)
	return (
		<Container
			pointerdown={() => (onSelect && canBeSelected) ? onSelect(id) : null}
		>
			<Circle xCoord={0} yCoord={0} color={0xFFFFFF} r={style.height/2}>
				<Text text={nick} anchor={0.5} style={{fontFamily : 'Arial', fontSize: 18, fill : 0xff1010, align : 'center'}}/>
			</Circle>
		</Container>
	)
};

export default PlayerBadge;
