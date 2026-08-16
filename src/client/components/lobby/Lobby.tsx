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
export class Lobby extends React.Component<ILobbyProps> {

	handleKickEvent = (playerId: string) => {
		this.props.controller.kickPlayer(playerId);
	};

	handleStartGame = () => {
		this.props.controller.startGame();
	}

	toggleReadyGame = () => {
		this.props.controller.toggleReady();
	}

	renderPlayersTable = () => {
		const {players, playersList} = this.props.controller;
		const currentPlayer = this.props.controller.currentPlayer;
		if (!currentPlayer) return <ErrorComponent/>;
		const currentPlayerIsHost = currentPlayer.isHost;
		const kickButton = (playerId: string) => currentPlayerIsHost ? <button className={"kick-button"} onClick={() => this.handleKickEvent(playerId)}>Кик</button> : null;
		// По playersList, а не по самому набору игроков: список — это порядок,
		// в котором садились, и номер в нём должен значить именно это. Заодно он
		// отвечает на главный вопрос лобби — сколько нас уже собралось (нужно
		// пятеро).
		return map(playersList, (playerId: string, index: number) => {
			const player: Player | null = players[playerId] ?? null;
			if (!player) return null;
			const isReady = player.isReady;
			const state = !player.isConnected ? 'Отключился' : player.isReady ? 'Готов' : '';
			return <div key={player.id} className={cx({'player-lobby-item': true, isReady})}>
				<span><span className={'player-lobby-number'}>{index + 1}.</span> {player.nickname} {` - ${state}`}</span>
				<span>{player.isHost && 'Хост'}</span>
				{ !player.isHost && kickButton(player.id) }
			</div>
		})
	};

	override render() {
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
