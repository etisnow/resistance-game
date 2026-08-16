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
	// Кого стол ждёт — таймер рассылается всем, но заголовок вкладки должен
	// реагировать только на свой. В «Сопротивлении» ждать могут сразу многих:
	// голосуют все разом.
	@observable playerIds: string[] = [];
	// Мгновение, с которого пошло текущее ожидание (Date.now()). Часы на прицеле
	// ведут стрелку по нему, а не по тикающим раз в секунду секундам: секунда —
	// это шестьдесят кадров, и по ним стрелка не шла бы, а прыгала (см. Reticle).
	@observable startedAt: number = 0;

	// Секунды в том же виде, в каком их видит игрок: полоски таймера на столе
	// больше нет, но в заголовок вкладки они уезжают (см. RootController).
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
		this.playerIds = [];
		this.startedAt = 0;
	};
	initTimer = ({text, seconds, playerIds}: ITimerPayload) => {
		if (this.timer) clearInterval(this.timer);
		this.text = text;
		this.initSeconds = seconds;
		this.currentSeconds = 0;
		this.isActive = true;
		this.playerIds = playerIds;
		this.startedAt = Date.now();
		this.timer = setInterval(() => {
			this.currentSeconds = this.currentSeconds + 1;
		}, 1000)
	}
}
