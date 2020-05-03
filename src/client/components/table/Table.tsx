import React, {useEffect, useRef} from 'react';
import './style.scss';
import {observer} from 'mobx-react-lite';
import GameController from 'client/controllers/gameController';
import Deck from 'client/components/table/Deck/Deck';
import GameLog from 'client/components/gameLog/GameLog';
import Room from 'client/components/table/Room/Room';
import Hand from 'client/components/table/Hand/Hand';
import Notifier from 'client/components/table/notifier/notifier';
import {Helmet} from "react-helmet";
import ActionInteracter from 'client/components/table/ActionInteracter/ActionInteracter';

interface ITableProps {
	controller: GameController
}

const Table = observer(({controller} : ITableProps) => {
		const player = controller.currentPlayer;
		const canvasWrapperEl = useRef(null);
		useEffect(() => {
			controller.root.pixiController.init(canvasWrapperEl.current)
		});
		if (!player) return null;
		const {hand} = player;
		if (!hand) return null;
		return (
			<div className={"gameTable"}>
				<GameLog controller={controller}/>
				<div ref={canvasWrapperEl} className={'canvasWrapper'}></div>
{/*				<Deck controller={controller}/>
				<Room controller={controller}/>
				<Hand controller={controller}/>
				<Notifier controller={controller}/>
				<ActionInteracter controller={controller}/>*/}
{/*				<button className={'fullscreenChangeButton'} onClick={() => {controller.toggleFullScreen()}}>
					{controller.isFullScreen ? 'Обычный' : 'Полноэкранный'}
				</button>*/}
				<button className={'layoutChangeButton'} onClick={() => {controller.toggleRoomLayout()}}>
					Вид: {controller.isLayoutSequential ? 'От игрока' : 'Сверху'}
				</button>
	            <Helmet>
	                <title>{player.nickname}</title>
	            </Helmet>
			</div>
		)
});

export default Table;
