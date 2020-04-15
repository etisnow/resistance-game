import React from 'react';
import './styles.scss';
import cx from 'classnames';
import {range, map} from 'lodash';


interface IPlayerBadgeProps {
	id: string;
	nickname: string | null;
	color: string;
	inTurn: boolean;
	canBeSelected: boolean;
	isDoor: boolean;
	onSelect: ((playerId: string) => void) | null;
	quarantine: number;
}

const formatNickname = (nickname) => {
	if (!nickname) return null;
	return nickname.substring(0,4).toUpperCase()
};

const TurnBadge = () => {
	return <div className={'turnBadge'}/>
};

const Quarantine = ({quarantine}) => {
	return quarantine ? (
		<div className={'quarantineBadge'}>
			{ map(range(quarantine), (q) => <div key={q} className={'quarantineDot'}/>) }
		</div>
	) :  null;
}

const PlayerBadge = ({nickname, color, inTurn = false, canBeSelected = false, onSelect = null, id, isDoor, quarantine}: IPlayerBadgeProps) => {
	return (
		<div className={cx({playerBadge: true, canBeSelected, isDoor, onQuarantine: quarantine > 0 })} style={{background: color}} onClick={() => (onSelect && canBeSelected) ? onSelect(id) : null}>
			{inTurn && <TurnBadge/>}
			{!isDoor && formatNickname(nickname)}
			<Quarantine quarantine={quarantine}/>
		</div>
	)
};

export default PlayerBadge;
