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

	// Дополнения: ставит их хост, читает весь стол. Не кнопкой, а строкой с
	// галочкой — это не действие, а условие партии, в которую садятся, и видно оно
	// должно быть всем, включая тех, кто его не меняет.
	renderOption = (
		{isOn, isEnabled, onChange, title, hint, isNested}:
		{isOn: boolean, isEnabled: boolean, onChange: (value: boolean) => void, title: string, hint: string, isNested?: boolean},
	) => (
		<label className={cx('lobby-option', {isOn, isReadonly: !isEnabled, isNested})}>
			<input type={'checkbox'} checked={isOn} disabled={!isEnabled} onChange={(e) => onChange(e.target.checked)}/>
			<span>
				<span className={'lobby-option-title'}>{title}</span>
				<span className={'lobby-option-hint'}>{hint}</span>
			</span>
		</label>
	);

	renderRoleOptions = () => {
		const {controller} = this.props;
		const isHost = !!controller.currentPlayer?.isHost;
		return <React.Fragment>
			{this.renderOption({
				isOn: controller.withMerlin,
				isEnabled: isHost,
				onChange: controller.setWithMerlin,
				title: 'С Мерлином и Убийцей',
				hint: 'Мерлин видит шпионов, а шпионы в конце стреляют в того, кого считают Мерлином',
			})}
			{/* Вложенная: Персиваль ищет глазами Мерлина, а Моргана нужна затем,
			    чтобы он ошибся, — без Мерлина этой пары не бывает (FR-16). */}
			{this.renderOption({
				isOn: controller.withPercival,
				isEnabled: isHost && controller.withMerlin,
				onChange: controller.setWithPercival,
				title: 'И с Персивалем с Морганой',
				hint: 'Персивалю показывают Мерлина — вместе с Морганой и не говоря, кто из них кто',
				isNested: true,
			})}
		</React.Fragment>;
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
				{this.renderRoleOptions()}
				{this.renderPlayersTable()}

			</div>
		)
	}
}
