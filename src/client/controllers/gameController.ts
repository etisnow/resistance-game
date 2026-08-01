import {computed, observable} from "mobx";
import SocketController from 'client/controllers/socketController';
import Player from 'client/models/Player';
import type INotificationAction from 'shared/interfaces/notification';
import RootController from 'client/controllers/rootController';
import {ECardType} from 'shared/enum/cards';
import {EAppState, EGameState} from 'shared/enum/common';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import {EPlayerActionType} from 'shared/enum/playerActions';
import type {IFormatTradeContext} from 'shared/interfaces/common';
import fscreen from 'fscreen';
import {each, merge} from "lodash";
import {EAsyncState} from 'shared/enum/async';
import type {
	IDeckPayload,
	IGameUpdatePayload,
	IHandActionsMap,
	IHandMap,
	IPlayersMap,
} from 'client/controllers/socketTypes';
import {ENotificationAction} from 'shared/enum/notifications';
import type {IGameLogEntry} from 'shared/interfaces/gameLog';

export default class GameController {
	root: RootController;
	socket: SocketController;

	@observable state: EGameState = EGameState.lobby;
	@observable id : string | null = null;
	@observable players: IPlayersMap = {};
	@observable currentPlayerId : string | null = null;
	@observable playersList: string[] = [];
	@observable gameLog: IGameLogEntry[] = [];
	// Лог свёрнут по умолчанию: он перекрывает стол, а самое важное (текущее
	// действие) дублируется крупным индикатором.
	@observable isGameLogOpen: boolean = false;
	@observable deck: IDeckPayload = {count: 0, topCardType: ECardType.event};
	@observable notifications: INotificationAction[] = [];
	@observable playersToSelect: string[] = [];
	@observable isLayoutSequential: boolean = true;
	@observable isFullScreen: boolean = false;
	@observable tradeContext: IFormatTradeContext[] | null = null;
	@observable currentAction: INotificationAction | null = null;
	@observable hand: IHandMap = {};
	@observable handActions: IHandActionsMap = {};
	@observable cardInPreview: string | null = null;
	@observable cardInNotificationPreview: string | null = null;
	@observable hostPlayerId: string = '';
	@observable isPlayerCanCancel: boolean = false;

	constructor(root: RootController) {
		this.root = root;
		this.socket = root.socketController;
		// E2E handle: the Playwright per-card specs drive the game through this
		// controller (the same methods the canvas pointer handlers invoke) and
		// read its observable state. Exposing it is harmless in production.
		if (typeof window !== 'undefined') {
			(window as unknown as {__nechto?: GameController}).__nechto = this;
		}
		fscreen.addEventListener('fullscreenchange', () => {
			this.isFullScreen = !!fscreen.fullscreenElement
		});
	}

	@computed get currentPlayer(): Player | null {
		if (!this.currentPlayerId) return null;
		return this.players[this.currentPlayerId] || null;
	}


	kickPlayer = (playerId: string) => {
		this.socket.sendToServer(EClientEventType.kickPlayer, { playerId })
	};

	startGame = () => {
		this.socket.sendToServer(EClientEventType.startGame, {})
	};

	toggleReady = () => {
		this.socket.sendToServer(EClientEventType.toggleReadyGame, {})
	};

	cardAction = (actionType: EPlayerActionType, cardUniqueId: string) => {
		this.socket.sendToServer(EClientEventType.playerAction, {actionType, cardUniqueId})
	};

	activatePlayerSelectMode = (notification: INotificationAction) => {
		this.playersToSelect = notification.type === ENotificationAction.playerSelect
			? notification.playersToSelect
			: [];
		this.notifications = this.notifications.slice(1);
	};

	selectNotificationCardPreview = (index: string) => {
		if (this.cardInNotificationPreview === index) {
			this.cardInNotificationPreview = null;
		} else {
			this.cardInNotificationPreview = index;
		}
	}

	// NOTE: reassign the observable array rather than mutating it (push/splice).
	// Under react-pixi-fiber, the Notifier observer only reliably re-renders on a
	// prop reassignment, not on in-place array mutation — see notifier.tsx.
	addNotification = (notification: INotificationAction) => {
		this.notifications = [...this.notifications, notification];
	};

	hidENotificationAction = () => {
		this.notifications = this.notifications.slice(1);
	};

	selectCard = (notification: INotificationAction, cardUniqueId: string) => {
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.cardSelect, actionContext: notification, cardUniqueId});
		this.hidENotificationAction();
	};

	selectPlayer = (playerId: string ) => {
		this.playersToSelect = [];
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.playerSelect, selectedPlayerId: playerId});
	};

	cardPick = () => {
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.cardPick});
	}

	actionDecision = (action: string ) => {
		this.hidENotificationAction();
		switch (action) {
			case 'restart':
				this.root.state = EAppState.game;
				this.state = EGameState.lobby;
				return;
			case 'exit':
				this.root.state = EAppState.launcher;
				this.root.launcherController.state = EAsyncState.idle;
				return;
			case 'hide':
				return;
		}
		this.playersToSelect = [];
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.actionDecision, action});
		this.hidENotificationAction();
	};

	toggleRoomLayout = () => {
		this.isLayoutSequential = !this.isLayoutSequential;
	}

	toggleFullScreen = () => {
		if (!fscreen.fullscreenEnabled) return;
		if (!this.isFullScreen) {
			fscreen.requestFullscreen(document.getElementById("root"));
		} else {
			fscreen.exitFullscreen();
		}
	};

	updateHand = (newHand: IHandMap) => {
		each(this.hand, card => {
			if (card.uniqueId && !newHand[card.uniqueId]) delete this.hand[card.uniqueId]
		});
		merge(this.hand, newHand)
	};

	updatePlayers = (newPlayers: IPlayersMap) => {
		merge(this.players, newPlayers);
		each(this.players, (player) => {
			if (player && !newPlayers[player.id]) {
				delete this.players[player.id];
			}
		})
	};

	updateHandActions = (handActions: IHandActionsMap) => {
		this.handActions = handActions
	};

	updateGame = ({tradeContext, players, playersList, deck, gameLog, currentAction, state, currentPlayer, hand, handActions, hostPlayerId, isPlayerCanCancel}: IGameUpdatePayload) => {
		this.updatePlayers(players);
		this.updateHand(hand);
		this.updateHandActions(handActions);
		this.hostPlayerId = hostPlayerId;
		this.playersList = playersList;
		this.deck = deck;
		this.isPlayerCanCancel = isPlayerCanCancel;
		this.currentPlayerId = currentPlayer.id;
		this.tradeContext = tradeContext;
		this.currentAction = currentAction;
		this.state = state;
		this.gameLog = gameLog;
	};

	toggleGameLog = () => {
		this.isGameLogOpen = !this.isGameLogOpen;
	};

	backToLauncher = () => {
		this.socket.sendToServer(EClientEventType.leaveGame, {})
		this.root.launcherController.state = EAsyncState.idle;
		this.root.state = EAppState.launcher;
	}

	actionCancel = () => {
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.actionCancel});
	}

	changePlayerMark = (playerId: string) => {
		this.socket.sendToServer(EClientEventType.markPlayer, {playerId});
	}
}
