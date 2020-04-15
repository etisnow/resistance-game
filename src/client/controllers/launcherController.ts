import {observable} from 'mobx';
import SocketController from 'client/controllers/socketController';
import RootController from 'client/controllers/rootController';
import {EAsyncState} from 'shared/enum/async';
import {EClientEventType} from 'shared/enum/enumClientEvents';


export default class LauncherController {

	root: RootController;
	parent: RootController;
	socket: SocketController;

	@observable state : EAsyncState = EAsyncState.idle;
	@observable nickname: string = Math.ceil(Math.random() * 100) + '_neerone';
	@observable gameId: string = '5';
	@observable games: {gameId: string, hostName: string}[] = [];
	constructor(root: RootController, parent) {
		this.root = root;
		this.parent = parent;
		this.socket = root.socketController;
	}

	changeNickname = (newNickname) => {
		this.nickname = newNickname;
	}

	changeGameId = (newGameId) => {
		this.gameId = newGameId;
	}

	createGame = () => {
		this.socket.sendToServer(EClientEventType.createGame, { nickname: this.nickname })
		this.state = EAsyncState.pending;
	}

	connectGame = (gameId) => {
		this.socket.sendToServer(EClientEventType.connectGame, { nickname: this.nickname, gameId })
		this.state = EAsyncState.pending;
	}
}
