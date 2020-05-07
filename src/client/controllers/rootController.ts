import { observable } from "mobx"
import LauncherController from 'client/controllers/launcherController';
import SocketController from 'client/controllers/socketController';
import GameController from 'client/controllers/gameController';
import {EAppState} from 'shared/enum/common';



export default class RootController {
	@observable state: EAppState = EAppState.launcher;
	@observable launcherController: LauncherController;
	@observable socketController: SocketController;
	@observable gameController: GameController;
	constructor(socket) {
		this.socketController = new SocketController(this, this, socket);
		this.gameController = new GameController(this);
		console.log('initing new game controller')
		this.launcherController = new LauncherController(this, this);
	}
}
