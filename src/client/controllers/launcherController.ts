import {observable} from 'mobx';
import SocketController from 'client/controllers/socketController';
import RootController from 'client/controllers/rootController';
import {EAsyncState} from 'shared/enum/async';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import localforage from 'localforage';
import * as PIXI from 'pixi.js';
import {resources} from 'client/resources/resources';
import { reduce } from 'lodash';


const asyncLoader = (): Promise<void> => {
	return new Promise<void>((resolve) => {
		let loader = reduce(resources, (l: PIXI.Loader, res) => {
			if (typeof res === 'string' && res[0] === '/') {
				l.add(res);
			}
			return l;
		}, new PIXI.Loader());
		loader = reduce(resources.playerBadges, (l: PIXI.Loader, res) => {
			if (typeof res === 'string' && res[0] === '/') {
				l.add(res);
			}
			return l;
		}, loader);
		loader.load(() => {
			resolve();
		});
	})
}

export default class LauncherController {

	root: RootController;
	parent: RootController;
	socket: SocketController;

	@observable state : EAsyncState = EAsyncState.pending;
	//@observable nickname: string = Math.ceil(Math.random() * 100) + '_neerone';
	@observable nickname: string = '';
	@observable gameId: string = '5';
	@observable games: {gameId: string, hostName: string}[] = [];
	constructor(root: RootController, parent: RootController) {
		this.root = root;
		this.parent = parent;
		this.socket = root.socketController;
	}

	changeNickname = async (newNickname: string) => {
		await localforage.setItem('nickname', newNickname)
		this.nickname = newNickname;
	}

	init = async () => {
		this.nickname = await localforage.getItem<string>('nickname') || ''
		if (this.root.isLoaded) {
			this.state = EAsyncState.idle;
			return;
		}
		this.state = EAsyncState.idle;
		await asyncLoader();
		this.root.isLoaded = true
	}

	changeGameId = (newGameId: string) => {
		this.gameId = newGameId;
	}

	createGame = () => {
		if (this.nickname.trim() === '') {
			alert('Необходимо заполнить ник');
			return
		}
		this.socket.sendToServer(EClientEventType.createGame, { nickname: this.nickname })
		this.state = EAsyncState.pending;
	}

	connectGame = (gameId: string) => {
		if (this.nickname.trim() === '') {
			alert('Необходимо заполнить ник');
			return
		}
		this.socket.sendToServer(EClientEventType.connectGame, { nickname: this.nickname, gameId })
		this.state = EAsyncState.pending;
	}
}
