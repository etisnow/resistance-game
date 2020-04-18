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

const Room = observer(({controller} : IRoomProps) => {

	const { currentPlayer, currentPlayerId } = controller;
	const { playersList, players } = controller;
	if (!currentPlayer || !currentPlayerId || !playersList) return null;

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
			transform: `translate(0px, 0px)`
		},
		enter: playerId => {
			const player = players[playerId];
			const currentDeg = (degDelta * newPlayerList.indexOf(playerId))  + 90;
			if (!player) return;
			const centerX = 0;
			const centerY = 0;
			const radius = circRadius(playersCount);
			const currentRad = degToRag(currentDeg);
			const x = radius*Math.cos(currentRad) + centerX;
			const y = radius*Math.sin(currentRad) + centerY;
			return {
				transform: `translate(${x}px, ${y}px)`
			}
		},
		update: playerId => {
			const player = players[playerId];
			const currentDeg = (degDelta * newPlayerList.indexOf(playerId))  + 90;
			if (!player) return;
			const centerX = 0;
			const centerY = 0;
			const radius = circRadius(playersCount);
			const currentRad = degToRag(currentDeg);
			const x = radius*Math.cos(currentRad) + centerX;
			const y = radius*Math.sin(currentRad) + centerY;
			return {
				transform: `translate(${x}px, ${y}px)`
			}
		},
		leave: player => {
			return {
				transform: `translate(0px, 0px)`
			}
		},
	} as any);




	const badgeDiagonal = playerRoomDiag(playersCount);
	return (
		<div className={"playerRoom"} style={{height: (circRadius(playersCount) * 2) + badgeDiagonal }}>
			{map(transitions, ({item: playerId, key, props: {transform}}) => {
				const player = players[playerId];
				if (!player || !player.id) return null;
				const {nickname, color, state} = player;
				const inTurn = player.turnState === ETurnState.inOffenseTrade || player.turnState === ETurnState.inCardAction;
				const canBeSelected = controller.playersToSelect && controller.playersToSelect.includes(player.id);
				return <animated.div
					key={key}
				    style={{
				        transform,
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
							quarantine={player.quarantine}
							isDoor={state === EPlayerState.door}
							onSelect={controller.selectPlayer}
						/>
					</div>
				</animated.div>
			})}
		</div>
	)
});

export default Room;

