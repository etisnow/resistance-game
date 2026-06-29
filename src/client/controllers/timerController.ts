import {observable} from 'mobx';
import SocketController from 'client/controllers/socketController';
import RootController from 'client/controllers/rootController';
import type {ITimerPayload} from 'client/controllers/socketTypes';
import UIfx from 'uifx'
import bellAudio from '../resources/sound/beep.mp3'

// Sound is non-critical — never let it break app startup.
let bell: UIfx | null = null;
try {
  bell = new UIfx(bellAudio, {
    volume: 0.2, // number between 0.0 ~ 1.0
    throttleMs: 100,
  });
} catch (e) {
  console.warn('Sound init failed', e);
}

export default class TimerController {

	root: RootController;
	parent: RootController;
	socket: SocketController;

	@observable isActive: boolean = false;
	@observable initSeconds: number = 0;
	@observable currentSeconds: number = 0;
	@observable text: string = '';

	timer: ReturnType<typeof setInterval> | null = null;
	constructor(root: RootController, parent: RootController) {
		this.root = root;
		this.parent = parent;
		this.socket = root.socketController;
	}

	playSound = () => {
		if (bell) bell.play();
	};
	clearTimers = () => {
		if (this.timer) clearInterval(this.timer);
		this.text = 'Игра завершена';
		this.initSeconds = 0;
		this.currentSeconds = 0;
		this.isActive = false;
	};
	initTimer = ({text, seconds}: ITimerPayload) => {
		if (this.timer) clearInterval(this.timer);
		this.text = text;
		this.initSeconds = seconds;
		this.currentSeconds = 0;
		this.isActive = true;
		this.timer = setInterval(() => {
			this.currentSeconds = this.currentSeconds + 1;
		}, 1000)
	}
}
