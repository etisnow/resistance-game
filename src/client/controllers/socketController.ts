import type { Socket } from 'socket.io-client';
import type INotificationAction from 'shared/interfaces/notification';
import RootController from 'client/controllers/rootController';
import {EAppState, EGameState} from 'shared/enum/common';
import {EServerEventType} from 'shared/enum/enumServerEvents';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import {ENotificationAction} from 'shared/enum/notifications';
import {EAsyncState} from 'shared/enum/async';
import { connect } from 'socket.io-client';
import type {
	ICommonErrorPayload,
	IGameConnectionSuccessPayload,
	IGameUpdatePayload,
	ILobbyUpdatePayload,
	ITimerPayload,
} from 'client/controllers/socketTypes';

// When the client is served from a real host (e.g. a tunnel), the API lives on
// the `api-` sibling subdomain (nechto.estaco.my -> api-nechto.estaco.my). On
// localhost we return undefined and connect same-origin (vite proxies socket.io).
function deriveServerUrl(): string | undefined {
	if (typeof window === 'undefined') return undefined;
	const { hostname, protocol, host } = window.location;
	if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') return undefined;
	if (hostname.startsWith('api-')) return undefined;
	return `${protocol}//api-${host}`;
}

function handleGlobalEvents(socket: Socket, root: RootController) {
	socket.on(EServerEventType.gameConnectionSuccess, ({players, game, currentPlayer}: IGameConnectionSuccessPayload) => {
		root.state = EAppState.game;
		root.gameController.currentPlayerId = currentPlayer.id;
		root.gameController.id = game.id;
		root.gameController.players = players
	});

	const updateGame = (updates: IGameUpdatePayload) => {
		root.state = EAppState.game;
		root.gameController.updateGame(updates)
	};

	socket.on(EServerEventType.commonError, ({error}: ICommonErrorPayload) => {
		alert(error)
		root.state = EAppState.launcher
		root.launcherController.state = EAsyncState.idle;
	});
	socket.on(EServerEventType.updateGame, updateGame);
	socket.on(EServerEventType.gameStarted, () => {
		root.state = EAppState.game;
		root.gameController.state = EGameState.sarted;
	});

	socket.on(EServerEventType.lobbyUpdate, ({games}: ILobbyUpdatePayload) => {
		root.launcherController.games = games;
	});

	socket.on(EServerEventType.soundNotification, () => {
		root.timerController.playSound()
	});

	socket.on(EServerEventType.timerNotification, (timerPayload: ITimerPayload) => {
		root.timerController.initTimer(timerPayload)
	});
	socket.on('connect', () => {
		console.log('connected');
		root.start();
	});
	socket.on(EServerEventType.notification, (notification: INotificationAction) => {
		switch (notification.type) {
			case ENotificationAction.info:
			case ENotificationAction.actionDecision:
			case ENotificationAction.okayCard:
			case ENotificationAction.selectCard:
				root.gameController.addNotification(notification);
				break;
			case ENotificationAction.gameEnd:
				root.gameController.addNotification(notification);
				root.timerController.clearTimers();
				root.gameController.currentAction = null;
				break;
			default:
				break;
		}
	})
}

export default class SocketController {

	root: RootController;
	parent: RootController;
	socket: Socket;

	constructor(root: RootController, parent: RootController) {
		// Server URL resolution:
		//  1. window.__SERVER_URL__  (runtime override, e.g. e2e)
		//  2. VITE_SERVER_URL        (build/dev env override)
		//  3. derived api-<host>     (when served from a non-local host, e.g. a
		//                             tunnel: nechto.estaco.my -> api-nechto.estaco.my)
		//  4. same origin            (localhost dev / preview proxy)
		const envUrl = import.meta.env ? import.meta.env.VITE_SERVER_URL : undefined;
		const winUrl = (typeof window !== 'undefined'
			? (window as Window & { __SERVER_URL__?: string }).__SERVER_URL__
			: undefined) || undefined;
		const serverUrl = winUrl || envUrl || deriveServerUrl() || undefined;
		const socket = serverUrl ? connect(serverUrl) : connect();
		this.root = root;
		this.parent = parent;
		this.socket = socket;
		handleGlobalEvents(socket, root)
	}

	sendToServer = (eventType: EClientEventType, payload: object) => {
		this.socket.emit(eventType, payload)
	}

}
