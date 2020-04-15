import React, {useEffect, useRef} from 'react';
import {observer} from 'mobx-react';
import './styles.scss';
import {map} from 'lodash';
import { animateScroll } from 'react-scroll';
import GameController from 'client/controllers/gameController';

interface IGameLogProps {
	controller: GameController
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
	return <div ref={gameLogRef} id="gameLog" className={'gameLogWrapper'}>
		{map(controller.gameLog, (log, index) => {
			return <div key={index}>{log}</div>
		})}
	</div>;

})


export default GameLog;
