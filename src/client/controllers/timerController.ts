import {observable} from 'mobx';
import SocketController from 'client/controllers/socketController';
import RootController from 'client/controllers/rootController';
import {EAsyncState} from 'shared/enum/async';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import localforage from 'localforage';
import UIfx from 'uifx'
const bellAudio = require('../resources/sound/beep.mp3')
//import bellAudio from 'client/resources/sound/beep.wav';


const bell = new UIfx(
  bellAudio,
  {
    volume: 0.2, // number between 0.0 ~ 1.0
    throttleMs: 100
  }
)

export default class TimerController {

	root: RootController;
	parent: RootController;
	socket: SocketController;

	@observable isActive: boolean = false;
	@observable seconds: number = 0;
	@observable text: string = '';
	constructor(root: RootController, parent) {
		this.root = root;
		this.parent = parent;
	}

	playSound = () => {
		bell.play();
	};

	initTimer = ({text, seconds}) => {
		this.text = text;
		this.seconds = seconds;
		console.log('INIT TIMER')
	}
}
