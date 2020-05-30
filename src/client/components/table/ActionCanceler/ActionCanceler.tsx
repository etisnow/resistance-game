import React from 'react';
import {observer} from "mobx-react-lite";
import GameController from 'client/controllers/gameController';
import {playerRoomDiag} from 'client/helpers/roomHelpers';
import {Container, Text} from 'react-pixi-fiber';
import {getWindowHeight, getWindowWidth} from 'client/helpers/window';
import Circle from 'client/components/pixiPrimitives/Circle';
import {ETurnState} from 'shared/enum/player';
import { AnimatedPixi } from '../pixiInjected';
import {config, useTransition} from 'react-spring';

interface IDeckProps {
	controller: GameController
}


const ActionCanceler = observer(({controller}: IDeckProps) => {
	const {currentPlayer:player, playersList, isPlayerCanCancel} = controller;
	const width = playerRoomDiag(playersList.length);
	const fontSize = width/3;
	if (!isPlayerCanCancel) return null;
	return (
		<AnimatedPixi.Container
			buttonMode={true}
			interactive={true}
			x={getWindowWidth()/2}
			y={getWindowHeight() + (width / 3)}
			pointerdown={controller.actionCancel}
		>
			<Circle
				r={width * 1.1}
				color={0xFF5200}
			/>
			<Text
				text={'Отмена'}
				y={-(fontSize * 2)}
				anchor={0.5}
				style={{fontFamily: 'Arial', fontSize: Math.round(fontSize / 1.5), fill: 0xFFFFFF}}
			/>
		</AnimatedPixi.Container>
	)


});

export default ActionCanceler;
