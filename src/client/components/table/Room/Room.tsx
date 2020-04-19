import React from 'react';
import {clone, map} from 'lodash';
import './styles.scss';
import {observer} from "mobx-react-lite";
import {animated, interpolate, useTransition} from 'react-spring';
import {circRadius, degToRag, playerRoomDiag} from 'client/helpers/roomHelpers';
import GameController from 'client/controllers/gameController';
import PlayerBadge from 'client/components/table/PlayerBadge/PlayerBadge';
import {EPlayerState, ETurnState} from 'shared/enum/player';

interface IRoomProps {
	controller: GameController
}

const getPositionFromPlayerList = ({players, degDelta, playerId, playerList, playersCount}) => {
	const player = players[playerId];
	const currentDeg = (degDelta * playerList.indexOf(playerId))  + 90;
	if (!player) return {x: 0, y:0};
	const centerX = 0;
	const centerY = 0;
	const radius = circRadius(playersCount);
	const currentRad = degToRag(currentDeg);
	const x = radius*Math.cos(currentRad) + centerX;
	const y = radius*Math.sin(currentRad) + centerY;
	return {x,y}
}

const Room = observer(({controller} : IRoomProps) => {

	const { currentPlayer, currentPlayerId } = controller;
	const { playersList, players } = controller;
	if (!currentPlayer || !currentPlayerId || !playersList) return null;
	const tradeContext = controller.tradeContext;
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
			transform: `translate(0px, 0px)`,
				tradeLineStartX: 0,
				tradeLineStartY: 0,
				tradeLineEndX: 0,
				tradeLineEndY: 0,
		},
		enter: playerId => {
			const {x,y} = getPositionFromPlayerList({players, degDelta, playerId, playerList: newPlayerList, playersCount});
			return {
				transform: `translate(${x}px, ${y}px)`,
				tradeLineStartX: 0,
				tradeLineStartY: 0,
				tradeLineEndX: 0,
				tradeLineEndY: 0,
			}
		},
		update: playerId => {
			const {x,y} = getPositionFromPlayerList({players, degDelta, playerId, playerList: newPlayerList, playersCount});
			let targetX = 0;
			let targetY = 0;
			const currentPlayerOffenseTrade = tradeContext && playerId === tradeContext.offensePlayerId;


			if (currentPlayerOffenseTrade) {
				const {x:xx,y: yy} = getPositionFromPlayerList({
					players,
					degDelta,
					playerId: tradeContext.defensePlayerId,
					playerList: newPlayerList,
					playersCount
				});
				targetX = xx;
				targetY = yy;
			}


			return {
				transform: `translate(${x}px, ${y}px)`,
				tradeLineStartX: targetX ? x : 0,
				tradeLineStartY: targetY ? y : 0,
				tradeLineEndX: targetX,
				tradeLineEndY: targetY,
				//tradeLine:
			} as any
		},
		leave: player => {
			return {
				transform: `translate(0px, 0px)`,
				tradeLineStartX: 0,
				tradeLineStartY: 0,
				tradeLineEndX: 0,
				tradeLineEndY: 0,
			}
		},
	} as any);




	const badgeDiagonal = playerRoomDiag(playersCount);
	const playerRoomHeight = (circRadius(playersCount) * 2) + badgeDiagonal;
	const canvasHeightWidth = {height: playerRoomHeight, width: playerRoomHeight }
	return (
		<div className={"playerRoom"} style={canvasHeightWidth}>
			{map(transitions, ({item: playerId, key, props }) => {
				const { tradeLineStartX, tradeLineStartY, tradeLineEndX, tradeLineEndY } = props as any;
				const player = players[playerId];
				if (!player || !player.id) return null;
				const {nickname, color, state} = player;
				const inTurn = player.turnState !== ETurnState.idle;
				const canBeSelected = controller.playersToSelect && controller.playersToSelect.includes(player.id);
				const tradeLineCenterOffset = playerRoomHeight / 2;
				return (
					<React.Fragment>
						<animated.div
							className={'badge-wrapper'}
							key={key}
						    style={{
						        transform: props.transform,
							    position: 'absolute',
							    width: `${badgeDiagonal}px`,
							    height: `${badgeDiagonal}px`,
							    transformOrigin: '50% 50%',
							    zIndex: 50,
						    }}
						>
							<div style={{width: `${badgeDiagonal}px`, height: `${badgeDiagonal}px`}}>
								<PlayerBadge
									nickname={nickname}
									color={color}
									inTurn={inTurn}
									canBeSelected={canBeSelected}
									id={player.id}
									isYou={player.isYou}
									isInjured={player.isInjured}
									isThing={player.isThing}
									quarantine={player.quarantine}
									isDoor={state === EPlayerState.door}
									onSelect={controller.selectPlayer}
								/>
							</div>
						</animated.div>
						<svg viewBox={`0 0 ${playerRoomHeight} ${playerRoomHeight}`} xmlns="http://www.w3.org/2000/svg" style={canvasHeightWidth}>
						  <animated.line
							  key={key}
							  x1={tradeLineStartX.interpolate((a) => a + tradeLineCenterOffset)}
							  x2={tradeLineEndX.interpolate((a) => a + tradeLineCenterOffset)}
							  y1={tradeLineStartY.interpolate((a) => a + tradeLineCenterOffset)}
							  y2={tradeLineEndY.interpolate((a) => a + tradeLineCenterOffset)}
							  stroke="yellow"
						  />
						</svg>
					</React.Fragment>
				)
			})}
		</div>
	)
});

export default Room;

