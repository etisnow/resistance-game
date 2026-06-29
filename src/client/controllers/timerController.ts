import {observable} from 'mobx';
import SocketController from 'client/controllers/socketController';
import RootController from 'client/controllers/rootController';
import {EAsyncState} from 'shared/enum/async';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import localforage from 'localforage';
import * as UIfxNS from 'uifx'
import bellAudio from '../resources/sound/beep.mp3'

// uifx is a CJS module exposing `.default`; normalise across bundler interop.
const UIfx: any = (UIfxNS as any).default || UIfxNS;

// Sound is non-critical — never let it break app startup.
let bell: any = null;
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

	timer: any = null;
	constructor(root: RootController, parent) {
		this.root = root;
		this.parent = parent;
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
	initTimer = ({text, seconds}) => {
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
