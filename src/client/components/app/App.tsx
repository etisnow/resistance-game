import React from 'react';
import 'client/components/app/App.scss';
import {observer} from 'mobx-react';
import GameScreen from 'client/components/game/GameScreen';
import Launcher from 'client/components/launcher/Launcher';
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
				{this.renderContent()}
			</div>
		);
	}
}

export default App;
