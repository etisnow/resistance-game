import React, {useEffect} from 'react';
import {observer} from 'mobx-react';
import './styles.scss';
import {each, find, map} from 'lodash';
import cn from 'classnames';
import {animateScroll} from 'react-scroll';
import GameController from 'client/controllers/gameController';
import {ENotificationAction} from 'shared/enum/notifications';
import {EGameLogType} from 'shared/enum/gameLogType';
import type {IGameLogEntry} from 'shared/interfaces/gameLog';

interface IGameLogProps {
	controller: GameController
}

// Иконка типа события — по ней строка читается, не вчитываясь в текст.
const LOG_ICONS: {[key in EGameLogType]: string} = {
	[EGameLogType.system]: '⚙',
	[EGameLogType.turn]: '▶',
	[EGameLogType.deck]: '📥',
	[EGameLogType.card]: '🃏',
	[EGameLogType.panic]: '⚡',
	[EGameLogType.trade]: '🔁',
	[EGameLogType.defense]: '🛡',
	[EGameLogType.quarantine]: '☣',
	[EGameLogType.death]: '💀',
	[EGameLogType.info]: '•',
};

// Цвет ника = порядковый номер игрока (player.color — это индекс бейджа).
const NICK_COLORS = [
	'#ff6b6b', '#4ecdc4', '#ffd93d', '#a29bfe', '#6ab04c',
	'#f78fb3', '#f0932b', '#7ed6df', '#e056fd', '#badc58',
	'#ff9f43',
];

interface INickHighlight {
	nickname: string;
	color: string;
	isYou: boolean;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getNickHighlights = (controller: GameController): INickHighlight[] => {
	const highlights: INickHighlight[] = [];
	each(controller.players, (player) => {
		if (!player || !player.nickname) return;
		const colorIndex = Number(player.color);
		highlights.push({
			nickname: player.nickname,
			color: NICK_COLORS[(isNaN(colorIndex) ? 0 : colorIndex) % NICK_COLORS.length] as string,
			isYou: player.isYou,
		});
	});
	// Длинные ники первыми: иначе ник, входящий в состав другого, разрежет его на части.
	return highlights.sort((a, b) => b.nickname.length - a.nickname.length);
};

const renderTextWithNicks = (text: string, highlights: INickHighlight[]) => {
	if (!highlights.length) return text;
	const pattern = new RegExp(`(${map(highlights, (h) => escapeRegExp(h.nickname)).join('|')})`, 'g');
	return map(text.split(pattern), (part, index) => {
		const highlight = find(highlights, (h) => h.nickname === part);
		if (!highlight) return <React.Fragment key={index}>{part}</React.Fragment>;
		return <span
			key={index}
			className={cn('logNick', {isYou: highlight.isYou})}
			style={{color: highlight.color}}
		>
			{part}
		</span>;
	});
};

const LogLine = ({entry, highlights}: {entry: IGameLogEntry, highlights: INickHighlight[]}) => {
	const type = entry.type || EGameLogType.info;
	return <div className={cn('logLine', `logLine--${type}`)}>
		<span className={'logIcon'}>{LOG_ICONS[type] || LOG_ICONS[EGameLogType.info]}</span>
		<span className={'logText'}>{renderTextWithNicks(entry.text, highlights)}</span>
	</div>;
};

export const getZIndex = (controller: GameController) => {
	if (controller.currentAction && controller.currentAction.type === ENotificationAction.actionDecision ) return 99;
	const firstNotification = controller.notifications.length ? controller.notifications[0] : undefined;
	if (firstNotification && firstNotification.type === ENotificationAction.gameEnd) return 99;
	const cardInPreview = controller.cardInPreview ? controller.hand[controller.cardInPreview] : undefined;
	if (cardInPreview || controller.notifications.length > 0) return 0;
	return 99;
}

const GameLog = observer(({controller}: IGameLogProps) => {
	const isOpen = controller.isGameLogOpen;
	const gameLog = controller.gameLog;
	useEffect(() => {
		if (!isOpen) return;
	    animateScroll.scrollToBottom({
			containerId: "gameLog",
			duration: 200,
	    });
	});
	const highlights = getNickHighlights(controller);
	const lastEntry = gameLog.length ? gameLog[gameLog.length - 1] : undefined;
	return <div style={{zIndex: getZIndex(controller)}} className={cn('gameLogWrapper', {isOpen})}>
		<div className={'gameLogHeader'} onClick={controller.toggleGameLog}>
			<span className={'gameLogChevron'}>{isOpen ? '▾' : '▸'}</span>
			<span className={'gameLogTitle'}>Логи</span>
			{!isOpen && lastEntry
				? <span className={'gameLogPreview'}><LogLine entry={lastEntry} highlights={highlights}/></span>
				: null}
		</div>
		{isOpen
			? <div id="gameLog" className={'gameLogList'}>
				{map(gameLog, (entry, index) => <LogLine key={index} entry={entry} highlights={highlights}/>)}
			</div>
			: null}
	</div>;

})


export default GameLog;
