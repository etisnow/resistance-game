import React from 'react';
import {observer} from 'mobx-react';
import {map} from 'lodash';
import LauncherController from 'client/controllers/launcherController';
import {Loader} from 'client/components/util/Loader';
import {EAsyncState} from 'shared/enum/async';

interface ILauncherProps {
	controller: LauncherController
}

@observer
class Launcher extends React.Component<ILauncherProps> {
	render() {
		if (this.props.controller.state === EAsyncState.pending) return <Loader/>;
		const {games} = this.props.controller;
		return (
			<div className="App">
				<form onSubmit={(e) => e.preventDefault() }>
					<br/>
					<input placeholder={'введи ник'} value={this.props.controller.nickname} onChange={(e) => this.props.controller.changeNickname(e.target.value)} required={true}/>
					<br/>
					<br/>
					Присоединись к игре
					<div className={'gameLobby'}>
						{map(games, ({gameId, hostName}) => {
							return <div key={gameId}>
								<button key={gameId} type={"submit"} onClick={() => this.props.controller.connectGame(gameId)}>
									{`Игра созданная ${hostName}`}
								</button>
							</div>
						})}
					</div>
					<button type={"submit"} onClick={this.props.controller.createGame}>Создать игру</button>
				</form>
			</div>
		);
	}
}

export default Launcher;
