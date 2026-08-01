import {autorun, observable} from "mobx";
import LauncherController from 'client/controllers/launcherController';
import SocketController from 'client/controllers/socketController';
import GameController from 'client/controllers/gameController';
import TimerController from 'client/controllers/timerController';
import {preloadAssets} from 'client/resources/preloader';
import {isWebGLAvailable} from 'client/helpers/webgl';
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
		this.syncDocumentTitle();
	}

	// Ник в заголовке вкладки: с несколькими открытыми окнами (или ботами в дев-режиме)
	// иначе не понять, кто где. Подписка одна на приложение — start() дёргается на
	// каждый реконнект, поэтому вешаем её в конструкторе, а контроллеры внутри
	// autorun читаются как observable и переподхватываются сами.
	private syncDocumentTitle() {
		if (typeof document === 'undefined') return;
		autorun(() => {
			const nickname = this.gameController?.currentPlayer?.nickname || this.launcherController?.nickname || '';
			document.title = nickname.trim() ? `${nickname.trim()} - Нечто` : 'Игра нечто';
		});
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
		// Без WebGL стол не нарисуется — не тянем 17 МБ картинок ради этого.
		if (!isWebGLAvailable()) {
			this.state = EAppState.noWebgl;
			return;
		}
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
