import React from 'react';
import 'client/components/app/App.scss';
import {observer} from 'mobx-react';
import GameScreen from 'client/components/game/GameScreen';
import Launcher from 'client/components/launcher/Launcher';
import {LoadingScreen} from 'client/components/loading/LoadingScreen';
import {RoomBackdrop} from 'client/components/app/RoomBackdrop';
import {WebGLMessage} from 'client/components/webgl/WebGLMessage';
import {EAppState} from 'shared/enum/common';
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
	override render() {
		return (
			<div className="nechto-wrapper">
				<RoomBackdrop/>
				{this.renderContent()}
			</div>
		);
	}
}

export default App;
