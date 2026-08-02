import React from 'react';
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
import ActionTimer from 'client/components/table/ActionTimer/ActionTimer';
import ActionCanceler from 'client/components/table/ActionCanceler/ActionCanceler';
import TableMenu from 'client/components/table/TableMenu/TableMenu';
import {StageBoundary} from 'client/components/table/StageBoundary';
import {TableStage} from 'client/components/table/TableStage';
import {CardHintOverlay} from 'client/components/hint/CardHint';


interface ITableProps {
	controller: GameController
}


const Table = observer(({controller} : ITableProps) => {
		const {currentPlayer:player, hand} = controller;
		if (!player || !hand) return null;

		return (
			<div className={"gameTable"}>
				<GameLog controller={controller}/>
				<TableMenu controller={controller}/>
				<ActionInteracter controller={controller}/>
				<ActionTimer controller={controller}/>
				<StageBoundary>
					<TableStage>
						<Deck controller={controller} />
						<Room controller={controller} />
						<Hand controller={controller} />
						<ActionCanceler controller={controller} />
						<Notifier controller={controller} />
					</TableStage>
				</StageBoundary>
				{/* Подсказка по тому, что нарисовано на столе: дверь, карантин. */}
				<CardHintOverlay/>

				{/*<div className={"debug-div"}><div></div></div>*/}
{/*
				<button className={'layoutChangeButton'} onClick={() => {controller.toggleRoomLayout()}}>
					Вид: {controller.isLayoutSequential ? 'От игрока' : 'Сверху'}
				</button>*/}
	            <Helmet>
	                <title>{player.nickname}</title>
	            </Helmet>
			</div>
		)
});

export default Table;
