import './style.scss';
import React from 'react';
import {observer} from 'mobx-react';
import {observer as observerLite} from 'mobx-react-lite';
import {map} from 'lodash';
import LauncherController from 'client/controllers/launcherController';
import {Loader} from 'client/components/util/Loader';
import {EAsyncState} from 'shared/enum/async';

interface ILauncherProps {
	controller: LauncherController
}

const GamesList = observerLite(({games, controller}: {games:any[], controller: LauncherController}) => {
	if (!games || games.length === 0) return null;

	return (
		<div>
			<br/>
			<br/>
			<span className={'or-label'}>ИЛИ</span>
			<br/>
			<label >Присоединись к игре</label>
			<div className={'gameLobby'}>
				{map(games, ({gameId, hostName}) => {
					return <div key={gameId}>
						<button className={"launcher-button"} key={gameId} type={"submit"} onClick={() => controller.connectGame(gameId)}>
							{`Игра созданная ${hostName}`}
						</button>
					</div>
				})}
			</div>
		</div>
	)
})

@observer
class Launcher extends React.Component<ILauncherProps> {
	render() {
		if (!this.props.controller) return null;
		if (this.props.controller.state === EAsyncState.pending) return <Loader/>;
		const {games} = this.props.controller;
		return (
			<div className="launcher-wrapper">
				<h1>Вход</h1>
				<form onSubmit={(e) => e.preventDefault() }>
					<label>Укажи ник</label>
					<input
						className={"nick-input"}
						placeholder={'введи ник'}
						value={this.props.controller.nickname}
						maxLength={4}
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
