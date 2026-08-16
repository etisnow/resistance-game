import React from 'react';
import 'client/components/app/App.scss';
import {observer} from 'mobx-react';
import GameScreen from 'client/components/game/GameScreen';
import Launcher from 'client/components/launcher/Launcher';
import AppMenu from 'client/components/app/AppMenu';
import {LoadingScreen} from 'client/components/loading/LoadingScreen';
import {RoomBackdrop} from 'client/components/app/RoomBackdrop';
import {WebGLMessage} from 'client/components/webgl/WebGLMessage';
import {EAppState, EGameState} from 'shared/enum/common';
import RootController from 'client/controllers/rootController';




type IAppProps = Record<string, never>;

@observer
class App extends React.Component<IAppProps> {
	controller: RootController;
	constructor(props: IAppProps) {
		super(props);
		this.controller = new RootController();
	}


	renderContent = () => {
		switch (this.controller.state) {
			case EAppState.loading:
				return <LoadingScreen progress={this.controller.loadProgress} />
			case EAppState.noWebgl:
				return <WebGLMessage />
			case EAppState.launcher:
				return <Launcher controller={this.controller.launcherController} />
			case EAppState.game:
				console.log('render game')
				return <GameScreen controller={this.controller.gameController} />
			default:
				return null
		}
	};
	// Стол разворачивают только в начатой партии; до неё игра живёт лаунчером,
	// лобби и экраном загрузки.
	isTableShown = (): boolean =>
		this.controller.state === EAppState.game && this.controller.gameController.state !== EGameState.lobby;

	override render() {
		return (
			<div className="resistance-wrapper">
				<RoomBackdrop/>
				{this.renderContent()}
				{/* Кнопка меню есть на любом экране. Здесь — короткое меню, одно на все
				    экраны без стола: держать его в каждом значило бы заводить три
				    одинаковых, и на одном из них его бы забыли (как забыли в лобби).
				    У стола меню своё, оно живёт внутри него (см. TableMenu). */}
				{!this.isTableShown() && <AppMenu sound={this.controller.soundController} />}
			</div>
		);
	}
}

export default App;
