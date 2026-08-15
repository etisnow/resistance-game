import React from 'react';
import './style.scss';
import {observer} from 'mobx-react-lite';
import GameController from 'client/controllers/gameController';
import GameLog from 'client/components/gameLog/GameLog';
import Room from 'client/components/table/Room/Room';
import Notifier from 'client/components/table/notifier/notifier';
import {Helmet} from "react-helmet";
import ActionInteracter from 'client/components/table/ActionInteracter/ActionInteracter';
import ActionTimer from 'client/components/table/ActionTimer/ActionTimer';
import TableMenu from 'client/components/table/TableMenu/TableMenu';
import MissionTrack from 'client/components/table/MissionTrack/MissionTrack';
import {StageBoundary} from 'client/components/table/StageBoundary';
import {TableStage} from 'client/components/table/TableStage';


interface ITableProps {
	controller: GameController
}


const Table = observer(({controller} : ITableProps) => {
		const {currentPlayer: player} = controller;
		if (!player) return null;

		return (
			<div className={"gameTable"}>
				<GameLog controller={controller}/>
				<MissionTrack controller={controller}/>
				<TableMenu controller={controller}/>
				<ActionInteracter controller={controller}/>
				<ActionTimer controller={controller}/>
				<StageBoundary>
					<TableStage>
						{/* Стол рисуется слоями по глубине: сначала дальняя половина
						    игроков, потом столешница (она их и подрезает), потом всё,
						    что на ней лежит, и только потом ближние игроки. Трек миссий
						    ляжет на столешницу и станет ребёнком Room — ровно в этот
						    промежуток (фаза 3). */}
						<Room controller={controller}/>
						<Notifier controller={controller} />
					</TableStage>
				</StageBoundary>

				{/*<div className={"debug-div"}><div></div></div>*/}
	            <Helmet>
	                <title>{player.nickname}</title>
	            </Helmet>
			</div>
		)
});

export default Table;
