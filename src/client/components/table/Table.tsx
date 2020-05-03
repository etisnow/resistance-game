import React from 'react';
import './style.scss';
import {observer} from 'mobx-react-lite';
import GameController from 'client/controllers/gameController';
import Deck from 'client/components/table/Deck/Deck';
import GameLog from 'client/components/gameLog/GameLog';
import Room from 'client/components/table/Room/Room';
//import Hand from 'client/components/table/Hand/Hand';
import Notifier from 'client/components/table/notifier/notifier';
import {Helmet} from "react-helmet";
import ActionInteracter from 'client/components/table/ActionInteracter/ActionInteracter';
import { Stage } from "react-pixi-fiber";
import { Globals } from 'react-spring/universal';
import {getWindowHeight, getWindowWidth} from 'client/helpers/window';


interface ITableProps {
	controller: GameController
}

Globals.injectApplyAnimatedValues((instance, { scale, ...props }) => {
  if (instance.pluginName) {
  	console.log('test')
    for (let prop in props) instance[prop] = props[prop]
    if (scale) instance.scale.set(scale)
  } else return false
}, style => style)
// injectFrame teaches react-spring the tools it needs to construct a game-loop, although
// we use a custom renderer (pixi), we're still in the web, so RAF is available
Globals.injectFrame(cb => { console.log('test'); return (global as any).requestAnimationFrame(cb)}, cb => (global as any).cancelAnimationFrame(cb))

const Table = observer(({controller} : ITableProps) => {
		const player = controller.currentPlayer;
		if (!player) return null;
		const {hand} = player;
		if (!hand) return null;
		return (
			<div className={"gameTable"}>
				<Stage className={"pixi-canvas"} options={{transparent: true, width: window.innerWidth, height: window.innerHeight}}>
					{/*<Hand controller={controller}/>*/}
				</Stage>
				<GameLog controller={controller}/>
{/*
				<Deck controller={controller}/>
				<Room controller={controller}/>
				<Notifier controller={controller}/>
				<ActionInteracter controller={controller}/>
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
