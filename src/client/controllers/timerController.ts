import {observable} from 'mobx';
import SocketController from 'client/controllers/socketController';
import RootController from 'client/controllers/rootController';
import {EAsyncState} from 'shared/enum/async';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import localforage from 'localforage';

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
		console.log('PLAY SOUND')
	};

	initTimer = ({text, seconds}) => {
		this.text = text;
		this.seconds = seconds;
		console.log('INIT TIMER')
	}
}
