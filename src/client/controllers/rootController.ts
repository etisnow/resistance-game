import {observable} from "mobx";
import LauncherController from 'client/controllers/launcherController';
import SocketController from 'client/controllers/socketController';
import GameController from 'client/controllers/gameController';
import TimerController from 'client/controllers/timerController';
import {EAppState} from 'shared/enum/common';


export default class RootController {
	@observable state: EAppState = EAppState.launcher;
	// Assigned in the constructor (socketController) and in start() (the rest, which
	// the constructor invokes), hence the definite-assignment assertions.
	@observable launcherController!: LauncherController;
	@observable socketController: SocketController;
	@observable gameController!: GameController;
	@observable timerController!: TimerController;
	@observable isLoaded : boolean = false;

	constructor() {
		this.socketController = new SocketController(this, this);
		this.start();
	}
	start() {
		this.timerController = new TimerController(this, this);
		this.gameController = new GameController(this);
		this.launcherController = new LauncherController(this, this);
		this.launcherController.init();
		this.state = EAppState.launcher;
	}
}
