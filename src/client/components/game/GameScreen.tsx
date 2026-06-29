import React from 'react';
import {observer} from 'mobx-react';
import Table from 'client/components/table/Table';
import {Lobby} from 'client/components/lobby/Lobby';
import GameController from 'client/controllers/gameController';
import {EGameState} from 'shared/enum/common';


interface ILauncherProps {
	controller: GameController
}

@observer
export default class GameScreen extends React.Component<ILauncherProps> {
	override render() {
		console.log(this.props.controller.state)
		if (this.props.controller.state === EGameState.lobby) return <Lobby controller={this.props.controller} />
		return (<Table controller={this.props.controller}/>)
	}
}
