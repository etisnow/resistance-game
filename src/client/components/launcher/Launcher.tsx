import './style.scss';
import React from 'react';
import {observer} from 'mobx-react';
import {observer as observerLite} from 'mobx-react-lite';
import {map} from 'lodash';
import LauncherController from 'client/controllers/launcherController';
import {Loader} from 'client/components/util/Loader';
import {EAsyncState} from 'shared/enum/async';
import type {ILobbyGameItem} from 'client/controllers/socketTypes';
import logo from 'client/resources/images/logo.png';

interface ILauncherProps {
	controller: LauncherController
}

// «1 игрок / 2 игрока / 5 игроков» — без склонения счётчик читается как опечатка.
const playersLabel = (count: number): string => {
	const tail = count % 10;
	const hundredTail = count % 100;
	if (hundredTail >= 11 && hundredTail <= 14) return `${count} игроков`;
	if (tail === 1) return `${count} игрок`;
	if (tail >= 2 && tail <= 4) return `${count} игрока`;
	return `${count} игроков`;
};

const GamesList = observerLite(({games, controller}: {games: ILobbyGameItem[], controller: LauncherController}) => {
	if (!games || games.length === 0) return null;

	return (
		<div>
			<br/>
			<br/>
			<span className={'or-label'}>ИЛИ</span>
			<br/>
			<label >Присоединись к игре</label>
			<div className={'gameLobby'}>
				{map(games, ({gameId, hostName, playersCount, isStarted}) => {
					return <div key={gameId}>
						<button className={"launcher-button game-item"} key={gameId} type={"submit"} onClick={() => controller.connectGame(gameId)}>
							<span className={'game-item-host'}>{`Игра созданная ${hostName}`}</span>
							<span className={'game-item-players'}>
								{playersLabel(playersCount)}{isStarted ? ' · идёт игра' : ''}
							</span>
						</button>
					</div>
				})}
			</div>
		</div>
	)
})

@observer
class Launcher extends React.Component<ILauncherProps> {
	override render() {
		if (!this.props.controller) return null;
		if (this.props.controller.state === EAsyncState.pending) return <Loader/>;
		const {games} = this.props.controller;
		return (
			<div className="launcher-wrapper">
				{/* Логотип вместо заголовка «Вход»: он и есть название игры, а что это
				    вход, видно по единственному полю с ником. Висит он выше формы своим
				    слоем, чтобы её не двигать (см. style.scss). */}
				<img className={'launcher-logo'} src={logo} alt={'Сопротивление'}/>
				<form onSubmit={(e) => e.preventDefault() }>
					<label>Укажи ник</label>
					<input
						className={"nick-input"}
						placeholder={'введи ник'}
						value={this.props.controller.nickname}
						onChange={(e) => this.props.controller.changeNickname(e.target.value)}
						required={true}
					/>
					<br/>
					<br/>
					<button className={"launcher-button"} type={"submit"} onClick={this.props.controller.createGame}>Создай игру</button>
					<GamesList games={games} controller={this.props.controller}/>
				</form>
			</div>
		);
	}
}

export default Launcher;
