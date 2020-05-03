import React from 'react';
import 'client/components/app/App.scss';
import io from 'socket.io-client';
import {observer} from 'mobx-react';
import GameScreen from 'client/components/game/GameScreen';
import Launcher from 'client/components/launcher/Launcher';
import {EAppState} from 'shared/enum/common';
import RootController from 'client/controllers/rootController';
var socket = io.connect('http://95.37.255.173:30');


@observer
class App extends React.Component<any, any> {
	controller: RootController;
	constructor(props) {
		super(props);
		this.controller = new RootController(socket);
	}
	renderContent = () => {
		switch (this.controller.state) {
			case EAppState.launcher:
				return <Launcher controller={this.controller.launcherController} />
			case EAppState.game:
				return <GameScreen controller={this.controller.gameController} />
		}
	};
	render() {
		return (
			<div className="nechto-wrapper">
				{this.renderContent()}
			</div>
		);
	}
}

export default App;
