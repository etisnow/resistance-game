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
import { Stage  } from "react-pixi-fiber";
import {getWindowHeight, getWindowWidth} from 'client/helpers/window';


interface ITableProps {
	controller: GameController
}


const Table = observer(({controller} : ITableProps) => {
		const {currentPlayer:player, hand} = controller;
		if (!player || !hand) return null;

		return (
			<div className={"gameTable"}>
				<GameLog controller={controller}/>
				<Stage
					className={"pixi-canvas"}
				    options={{
				    	width:getWindowWidth(),
					    height:getWindowHeight(),
					    resolution:window.devicePixelRatio,
					    transparent:true,
					    antialias:true
				    }}
				>
					<Deck controller={controller} />
					<Room controller={controller} />
					<Hand controller={controller} />
				</Stage>

				<Notifier controller={controller}/>
				<ActionInteracter controller={controller}/>
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
