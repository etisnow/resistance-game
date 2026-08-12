import {computed, observable} from 'mobx';
import SocketController from 'client/controllers/socketController';
import RootController from 'client/controllers/rootController';
import type {ITimerPayload} from 'client/controllers/socketTypes';
import {playBell} from 'client/helpers/sounds';

export default class TimerController {

	root: RootController;
	parent: RootController;
	socket: SocketController;

	@observable isActive: boolean = false;
	@observable initSeconds: number = 0;
	@observable currentSeconds: number = 0;
	@observable text: string = '';
	// Чей ход отсчитываем — таймер рассылается всем, но заголовок вкладки должен
	// реагировать только на свой.
	@observable playerId: string = '';

	// Секунды в том же виде, в каком их видит игрок на столе (ActionTimer).
	@computed get seconds(): number {
		return this.currentSeconds < 0 ? Math.abs(this.currentSeconds) + this.initSeconds : this.currentSeconds;
	}

	timer: ReturnType<typeof setInterval> | null = null;
	constructor(root: RootController, parent: RootController) {
		this.root = root;
		this.parent = parent;
		this.socket = root.socketController;
	}

	playSound = playBell;
	clearTimers = () => {
		if (this.timer) clearInterval(this.timer);
		this.text = 'Игра завершена';
		this.initSeconds = 0;
		this.currentSeconds = 0;
		this.isActive = false;
		this.playerId = '';
	};
	initTimer = ({text, seconds, playerId}: ITimerPayload) => {
		if (this.timer) clearInterval(this.timer);
		this.text = text;
		this.initSeconds = seconds;
		this.currentSeconds = 0;
		this.isActive = true;
		this.playerId = playerId;
		this.timer = setInterval(() => {
			this.currentSeconds = this.currentSeconds + 1;
		}, 1000)
	}
}
