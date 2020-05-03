import { observable } from "mobx"
import LauncherController from 'client/controllers/launcherController';
import SocketController from 'client/controllers/socketController';
import GameController from 'client/controllers/gameController';
import {EAppState} from 'shared/enum/common';
import {PixiController} from 'client/controllers/pixiController';



export default class RootController {
	@observable state: EAppState = EAppState.launcher;
	@observable launcherController: LauncherController;
	@observable socketController: SocketController;
	@observable gameController: GameController;
	pixiController: PixiController;
	constructor(socket) {
		this.socketController = new SocketController(this, this, socket);
		this.gameController = new GameController(this);
		this.launcherController = new LauncherController(this, this);
		this.pixiController = new PixiController(this);
	}
}
