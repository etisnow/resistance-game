import './style.scss';

import React from 'react';
import {observer} from 'mobx-react';
import {map, some} from 'lodash';
import Player from 'client/models/Player';
import GameController from 'client/controllers/gameController';
import {ErrorComponent} from 'client/components/util/Error';
import cx from 'classnames';

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

	toggleReadyGame = () => {
		this.props.controller.toggleReady();
	}

	renderPlayersTable = () => {
		const players = this.props.controller.players;
		const currentPlayer = this.props.controller.currentPlayer;
		if (!currentPlayer) return <ErrorComponent/>;
		const currentPlayerIsHost = currentPlayer.isHost;
		const kickButton = (playerId) => currentPlayerIsHost ? <button className={"kick-button"} onClick={() => this.handleKickEvent(playerId)}>Кик</button> : null;
		console.log('PLAYERS IN THA TABLE', players)
		return map(players, (player : Player | null) => {
			const isReady = player.isReady;
			if (!player) return null;
			const state = !player.isConnected ? 'Отключился' : player.isReady ? 'Готов' : '';
			return <div key={player.id} className={cx({'player-lobby-item': true, isReady})}>
				<span>{player.nickname} {` - ${state}`}</span>
				<span>{player.isHost && 'Хост'}</span>
				{ !player.isHost && kickButton(player.id) }
			</div>
		})
	};

	render() {
		const currentPlayer = this.props.controller.currentPlayer;
		if (!currentPlayer) return null;
		const isAllReady = this.props.controller.playersList.length > 3 && !some(this.props.controller.players, {isReady:false});
		return (
			<div className="launcher-wrapper">
				<span className={'lobby-back'} onClick={this.props.controller.backToLauncher}>← назад</span>
				<h1>Лобби игры</h1>
				{currentPlayer.isHost && (
					<button className={'launcher-button'} disabled={!isAllReady} onClick={this.handleStartGame}>Начать игру</button>
				)}
				<button className={'launcher-button'} onClick={this.toggleReadyGame}>
					{currentPlayer.isReady ? 'Я пока не готов' : 'Я готов к игре!'}
				</button>
				{this.renderPlayersTable()}

			</div>
		)
	}
}
