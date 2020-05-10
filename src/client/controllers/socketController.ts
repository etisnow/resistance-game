import {SocketIOClient} from 'socket.io-client';
import INotificationAction from 'shared/interfaces/notification';
import RootController from 'client/controllers/rootController';
import {EAppState, EGameState} from 'shared/enum/common';
import {EServerEventType} from 'shared/enum/enumServerEvents';
import {ENotificationAction} from 'shared/enum/notifications';
import {EAsyncState} from 'shared/enum/async';
import io from 'socket.io-client';

function handleGlobalEvents(socket, root: RootController) {
	socket.on(EServerEventType.gameConnectionSuccess, ({players, player, game, currentPlayer}) => {
		root.state = EAppState.game;
		root.gameController.currentPlayerId = currentPlayer.id;
		root.gameController.id = game.id;
		root.gameController.players = players
	});

	const updateGame = (updates) => {
		root.state = EAppState.game;
		root.gameController.updateGame(updates)
	};

	socket.on(EServerEventType.commonError, ({error}) => {
		alert(error)
		root.state = EAppState.launcher
		root.launcherController.state = EAsyncState.idle;
	});
	socket.on(EServerEventType.updateGame, updateGame);
	socket.on(EServerEventType.gameStarted, () => {
		root.state = EAppState.game;
		root.gameController.state = EGameState.sarted;
	});

	socket.on(EServerEventType.lobbyUpdate, ({games}) => {
		root.launcherController.games = games;
	});

	socket.on(EServerEventType.notification, (notification: INotificationAction) => {
		switch (notification.type) {
			case ENotificationAction.info:
			case ENotificationAction.actionDecision:
			case ENotificationAction.okayCard:
			case ENotificationAction.selectCard:
				root.gameController.notifications.push(notification);
			default:
				return null
		}
	})
}

export default class SocketController {

	root: RootController;
	parent: RootController;
	socket: SocketIOClient.Socket;

	constructor(root, parent) {
		var socket = io.connect('http://botilo.hldns.ru:30');
		this.root = root;
		this.parent = parent;
		this.socket = socket;
		handleGlobalEvents(socket, root)
	}

	sendToServer = (eventType, payload) => {
		this.socket.emit(eventType, payload)
	}

}
