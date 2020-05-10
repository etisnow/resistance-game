import React, {useEffect, useLayoutEffect} from 'react';
import {clamp, clone, map} from 'lodash';
import './styles.scss';
import {observer} from "mobx-react-lite";
import {animated, config, interpolate, useTransition} from 'react-spring/universal';
import {circRadius, degToRag, playerRoomDiag} from 'client/helpers/roomHelpers';
import GameController from 'client/controllers/gameController';
import PlayerBadge from 'client/components/table/PlayerBadge/PlayerBadge';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ENotificationAction} from 'shared/enum/notifications';
import {AnimatedPixi} from 'client/components/table/pixiInjected';
import { Container, Text } from 'react-pixi-fiber';
import {getWindowHeight, getWindowWidth} from 'client/helpers/window';
import Arrow from 'client/components/pixiPrimitives/Arrow';

interface IRoomProps {
	controller: GameController
}

const getPlayerDeg = (playerId, playerList) => {
	const playersCount = playerList.length;
	const degDelta = 360 / playersCount;
	const currentDeg = (degDelta * playerList.indexOf(playerId))  + 90;
	return currentDeg;
}

const getCirclePoint = (radius, deg, centerX, centerY) => {
	const currentRad = degToRag(deg);
	const x = radius*Math.cos(currentRad) + centerX;
	const y = radius*Math.sin(currentRad) + centerY;
	return {x,y};
}

const getPositionFromPlayerList = ({players, playerId, playerList}) => {
	const player = players[playerId];
	if (!player) return {x: 0, y:0};
	const playersCount = playerList.length;
	const currentDeg = getPlayerDeg(playerId, playerList);
	const centerX = 0;
	const centerY = 0;
	const radius = circRadius(playersCount);
	return getCirclePoint(radius, currentDeg, centerX, centerY)
}


const midpoint = (x1,y1,x2,y2) => {
	return {
		x: (x1+x2) /2,
		y: (y1+y2) /2
	}
}

//const arrowHeight = 0.05;
const arrowWidth = 10;

const getDistanceBetweenPoints = (x1,y1,x2,y2) => {
	return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

const getColorByArrowType = (arrowType) => {
	switch (arrowType) {
		case ETurnContextType.positionswap:
			return 0x00adff;
		case ETurnContextType.burn:
			return 0xff0000;
		default:
			return 0xffdf00;
	}
}

const lineAnimation = ({type, newPlayerList, badgeRadius, offensePlayerId, defensePlayerId, players}) => {
	const biggerBadgeRad = badgeRadius + 5;
	const playersCount = newPlayerList.length;
	const iterateDegree = 360 / playersCount;

	const {x:ax,y:ay} = getPositionFromPlayerList({players, playerId: offensePlayerId, playerList: newPlayerList});
	const {x:bx,y:by} = getPositionFromPlayerList({players, playerId: defensePlayerId, playerList: newPlayerList});

	//const AbadgeDeg = getPlayerDeg(offensePlayerId, newPlayerList);
	//const BbadgeDeg = getPlayerDeg(defensePlayerId, newPlayerList);

	var angleBetweenPointsDeg = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;


	const APlayerDegree = angleBetweenPointsDeg;
	const BPlayerDegree = angleBetweenPointsDeg - 180;

	const {y:newAY,x:newAX} = getCirclePoint(biggerBadgeRad, APlayerDegree, ax, ay);
	const {y:arrowY,x:arrowX} = getCirclePoint(biggerBadgeRad, BPlayerDegree, bx, by);
	const distanceBetweenArrow = getDistanceBetweenPoints(newAX,newAY,arrowX,arrowY);
	const arrowHeight = clamp(distanceBetweenArrow * 0.35, 3, 15);
	const {y:newBY,x:newBX} = getCirclePoint(biggerBadgeRad + arrowHeight, BPlayerDegree, bx, by);

	const {x: midX, y:midY} = midpoint(newAX, newAY, newBX, newBY);

	const {x: offsettedMid1X, y: offsettedMid1Y} = getCirclePoint(biggerBadgeRad/4, angleBetweenPointsDeg - 90, midX, midY);
	const {x: offsettedMid2X, y: offsettedMid2Y} = getCirclePoint(biggerBadgeRad/4, angleBetweenPointsDeg + 90, midX, midY);


	return {
		ax:newAX,
		ay:newAY,
		bx: newBX,
		by: newBY,
		mid1X: offsettedMid1X,
		mid1Y: offsettedMid1Y,
		mid2X: offsettedMid2X,
		mid2Y: offsettedMid2Y,
		arrowX: arrowX,
		arrowY: arrowY,
		arrowRotation: angleBetweenPointsDeg + 90,
		arrowHeight: arrowHeight,
		color: getColorByArrowType(type),
	} as any
}


const Room = observer(({controller} : IRoomProps) => {

	const { currentPlayer, currentPlayerId } = controller;
	const { playersList, players } = controller;
	if (!currentPlayer || !currentPlayerId || !playersList) return null;
	const tradeContext = controller.tradeContext || [];
	let newPlayerList = clone(playersList);
	if (controller.isLayoutSequential) {
		const indexOfCurrentPlayer = playersList.indexOf(currentPlayerId);
		let beforeCurrentPlayer = newPlayerList.slice(0, indexOfCurrentPlayer);
		newPlayerList.splice(0, indexOfCurrentPlayer);
		newPlayerList = newPlayerList.concat(beforeCurrentPlayer);
	}


	const playersCount = newPlayerList.length;
	const degDelta = 360 / playersCount;

	const transitions = useTransition(newPlayerList, playerId=>playerId, {
		from: {
			x:0, y:0
		} as any,
		enter: playerId => {
			return getPositionFromPlayerList({players, playerId, playerList: newPlayerList}) as any;
		},
		update: playerId => {
			return getPositionFromPlayerList({players, playerId, playerList: newPlayerList}) as any;
		},
		leave: player => {
			return {
				x:0, y:0
			} as any
		},
	} as any);

	const badgeDiagonal = playerRoomDiag(playersCount);
	const badgeRadius = badgeDiagonal/2;
	const playerRoomHeight = (circRadius(playersCount) * 2) + badgeDiagonal;
	const arrows = useTransition(tradeContext, ({offensePlayerId}) => offensePlayerId, {
		enter: ({offensePlayerId, defensePlayerId, type}) => {
			const {ax,ay, arrowRotation, color} = lineAnimation({type, newPlayerList, badgeRadius, offensePlayerId, defensePlayerId, players});
			return {
				ax,
				ay,
				bx: ax,
				by: ay,
				mid1X: ax,
				mid1Y: ay,
				mid2X: ax,
				mid2Y: ay,
				arrowX: ax,
				arrowY: ay,
				arrowRotation,
				arrowHeight: 0,
				color,
			} as any
		},
		update: ({offensePlayerId, defensePlayerId, type}) => {
			return lineAnimation({type, newPlayerList, badgeRadius, offensePlayerId, defensePlayerId, players});
		},
		config: config.stiff
	} as any);



	const canPlayerBeSelected = (player) => {
		if (controller.currentAction && controller.currentAction.type === ENotificationAction.playerSelect) {
			return controller.currentAction.playersToSelect.includes(player.id)
		}
		return false;
	}

	return (
		<Container x={getWindowWidth()/2} y={getWindowHeight()/2}>
			{map(transitions, ({item: playerId, key, props:{x, y} }) => {
				const player = players[playerId];
				if (!player || !player.id) return null;
				const {nickname, color, state} = player;
				const inTurn = player.turnState !== ETurnState.idle;
				const canBeSelected = canPlayerBeSelected(player);
				return (
					<AnimatedPixi.Container
						key={key}
						x={x}
						y={y}
					>
						<PlayerBadge
							style={{width:badgeDiagonal, height:badgeDiagonal}}
							nickname={nickname}
							color={color}
							inTurn={inTurn}
							canBeSelected={canBeSelected}
							id={player.id}
							isConnected={player.isConnected}
							isYou={player.isYou}
							isInfected={player.isInfected}
							isThing={player.isThing}
							quarantine={player.quarantine}
							isDoor={state === EPlayerState.door}
							onSelect={controller.selectPlayer}
						/>
					</AnimatedPixi.Container>
				)
			})}
			{map(arrows, ({item: arrow, key, props }) => {
				if (!props.bx || !props.by || !props.bx || !props.by) return
				return (
					<Container key={key}>
						<AnimatedPixi.Arrow
							{...props}
						/>
					</Container>
				)
			})}
		</Container>
	)
});

export default Room;

