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
import { Stage, Text, applyProps, Sprite, Container  } from "react-pixi-fiber";
import { Globals, createAnimatedComponent, Animated, animated } from 'react-spring/universal';
import {getWindowHeight, getWindowWidth} from 'client/helpers/window';
//import * as PIXI from 'pixi.js'
//import * as Animated from "animated";


interface ITableProps {
	controller: GameController
}
//Globals.injectApplyAnimatedValues(
//  (instance, props) => {
//  	console.log('test')
//    return instance.setNativeProps ? instance.setNativeProps(props) : false
//  },
//  style => style
//)
//Globals.injectFrame(cb => (global as any).requestAnimationFrame(cb), cb => (global as any).cancelAnimationFrame(cb))

/*

Globals.injectApplyAnimatedValues((instance, { scale, ...props }) => {
	console.log('test')
  if (instance.pluginName) {
  	console.log('test')
    for (let prop in props) instance[prop] = props[prop]
    if (scale) instance.scale.set(scale)
  } else return false
}, style => style)
// injectFrame teaches react-spring the tools it needs to construct a game-loop, although
// we use a custom renderer (pixi), we're still in the web, so RAF is available
Globals.injectFrame(cb => { console.log('test'); return (global as any).requestAnimationFrame(cb)}, cb => (global as any).cancelAnimationFrame(cb))*/

const Table = observer(({controller} : ITableProps) => {
		const {currentPlayer:player, hand} = controller;
		if (!player || !hand) return null;

		return (
			<div className={"gameTable"}>
				<GameLog controller={controller}/>
				<Stage className={"pixi-canvas"} options={{width:getWindowWidth(), height:getWindowHeight(), resolution:window.devicePixelRatio, transparent:true, antialias:true}}>
					<Room controller={controller}/>
					<Hand controller={controller}/>
					<Notifier controller={controller}/>
				</Stage>

				<div className={"debug-div"}><div></div></div>
{/*
				<Deck controller={controller}/>
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
