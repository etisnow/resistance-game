import React from 'react';
import {observer} from 'mobx-react';
import {map} from 'lodash';
import Player from 'client/models/Player';
import GameController from 'client/controllers/gameController';
import {ErrorComponent} from 'client/components/util/Error';


interface ILobbyProps {
	controller: GameController
}

@observer
export class Lobby extends React.Component<ILobbyProps, any> {

	handleKickEvent = (playerId) => {
		this.props.controller.kickPlayer(playerId);
	};

	handleStartGame = () => {
		this.props.controller.startGame();
	}

	renderPlayersTable = () => {
		const players = this.props.controller.players;
		const currentPlayer = this.props.controller.currentPlayer;
		if (!currentPlayer) return <ErrorComponent/>;
		const currentPlayerIsHost = currentPlayer.isHost;
		const kickButton = (playerId) => currentPlayerIsHost ? <button onClick={() => this.handleKickEvent(playerId)}>Убрать</button> : null;
		return map(players, (player : Player | null) => {
			if (!player) return null;
			return <div key={player.id}>{player.nickname} {player.isHost && 'Хост'} { !player.isHost && kickButton(player.id)} </div>
		})
	};

	render() {
		const currentPlayer = this.props.controller.currentPlayer;
		if (!currentPlayer) return null;
		return (
			<React.Fragment>
				<strong>ID игры - {this.props.controller.id}</strong>
				{this.renderPlayersTable()}
				{currentPlayer.isHost && <button onClick={this.handleStartGame}>Начать игру</button>}
			</React.Fragment>
		)
	}
}
