import React, {useEffect, useRef} from 'react';
import {observer} from 'mobx-react';
import './styles.scss';
import {map} from 'lodash';
import {animateScroll} from 'react-scroll';
import GameController from 'client/controllers/gameController';
import {ENotificationAction} from 'shared/enum/notifications';

interface IGameLogProps {
	controller: GameController
}

export const getZIndex = (controller: GameController) => {
	if (controller.currentAction && controller.currentAction.type === ENotificationAction.actionDecision ) return 99;
	const firstNotification = controller.notifications[0];
	if (firstNotification && firstNotification.type === ENotificationAction.gameEnd) return 99;
	const cardInPreview = controller.cardInPreview ? controller.hand[controller.cardInPreview] : undefined;
	if (cardInPreview || controller.notifications.length > 0) return 0;
	return 99;
}

const GameLog = observer(({controller}: IGameLogProps) => {
	const gameLogRef = useRef(null);
	useEffect(() => {
		if (!gameLogRef || !gameLogRef.current) return;
	    animateScroll.scrollToBottom({
			containerId: "gameLog",
			duration: 200,
	    });
	});
	return <div ref={gameLogRef} id="gameLog" style={{zIndex: getZIndex(controller)}} className={'gameLogWrapper'}>
		{map(controller.gameLog, (log, index) => {
			return <div key={index}>{log}</div>
		})}
	</div>;

})


export default GameLog;
