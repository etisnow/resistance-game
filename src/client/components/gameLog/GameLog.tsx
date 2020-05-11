import React, {useEffect, useRef} from 'react';
import {observer} from 'mobx-react';
import './styles.scss';
import {map} from 'lodash';
import { animateScroll } from 'react-scroll';
import GameController from 'client/controllers/gameController';
import {Game} from 'server/models/Game';

interface IGameLogProps {
	controller: GameController
}

export const getZIndex = (controller: GameController) => {
	if (controller.cardInPreview || controller.notifications.length > 0) return 0;
	return 99;
}

const GameLog = observer(({controller}: IGameLogProps) => {
	const gameLogRef = useRef(null);
	useEffect(() => {
		console.log('LOG MOUNTED')
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
