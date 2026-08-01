import {observable} from "mobx";
import LauncherController from 'client/controllers/launcherController';
import SocketController from 'client/controllers/socketController';
import GameController from 'client/controllers/gameController';
import TimerController from 'client/controllers/timerController';
import {preloadAssets} from 'client/resources/preloader';
import {EAppState} from 'shared/enum/common';


export default class RootController {
	@observable state: EAppState = EAppState.loading;
	// Assigned in the constructor (socketController) and in start() (the rest, which
	// the constructor invokes), hence the definite-assignment assertions.
	@observable launcherController!: LauncherController;
	@observable socketController: SocketController;
	@observable gameController!: GameController;
	@observable timerController!: TimerController;
	@observable isLoaded : boolean = false;
	@observable loadProgress: number = 0;

	constructor() {
		this.socketController = new SocketController(this, this);
		this.start();
	}
	start() {
		this.timerController = new TimerController(this, this);
		this.gameController = new GameController(this);
		this.launcherController = new LauncherController(this, this);
		this.launcherController.init();
		this.loadAssets();
	}

	// Ассеты грузим до лобби: дальше карты и бейджи рисуются из кэша PIXI, без
	// «пустых» спрайтов в первые секунды игры.
	// NOTE: start() дёргается ещё и на socket 'connect' (в т.ч. при реконнекте),
	// поэтому загрузка идёт ровно один раз — иначе второй проход стартовал бы
	// поверх незавершённого первого.
	private assetsLoading: Promise<void> | null = null;
	private loadAssets() {
		if (this.isLoaded) {
			this.state = EAppState.launcher;
			return;
		}
		this.state = EAppState.loading;
		if (!this.assetsLoading) {
			this.assetsLoading = preloadAssets((progress) => {
				this.loadProgress = progress;
			});
		}
		this.assetsLoading.then(() => {
			this.isLoaded = true;
			// Пока грузились, сокет мог увести нас в игру (реконнект) — не отбираем экран.
			if (this.state === EAppState.loading) this.state = EAppState.launcher;
		});
	}
}
