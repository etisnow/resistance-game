import {computed, observable} from "mobx";
import SocketController from 'client/controllers/socketController';
import Player from 'client/models/Player';
import INotificationAction from 'shared/interfaces/notification';
import RootController from 'client/controllers/rootController';
import {ECardType} from 'shared/enum/cards';
import {EAppState, EGameState} from 'shared/enum/common';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {IFormatTradeContext} from 'shared/interfaces/common';
import fscreen from 'fscreen';
import {each, merge} from "lodash";
import {ICardEvent} from 'shared/interfaces/cards';
import {EAsyncState} from 'shared/enum/async';

export default class GameController {
	root: RootController;
	socket: SocketController;

	@observable state: EGameState = EGameState.lobby;
	@observable id : string | null = null;
	@observable players: {[key: string]: Player | null } = {};
	@observable currentPlayerId : string | null = null;
	@observable playersList: string[] = [];
	@observable gameLog: string[] = [];
	@observable deck: {count: number, topCardType: ECardType} = {count: 0, topCardType: ECardType.event};
	@observable notifications: INotificationAction[] = [];
	@observable playersToSelect: string[] = [];
	@observable isLayoutSequential: boolean = true;
	@observable isFullScreen: boolean = false;
	@observable tradeContext: IFormatTradeContext[] | null = null;
	@observable currentAction: INotificationAction | null = null;
	@observable hand: {[key:string]: ICardEvent} = {};
	@observable handActions: {[key: string]: any[] } = {};
	@observable cardInPreview: string | null = null;
	@observable cardInNotificationPreview: string | null = null;
	@observable hostPlayerId: string = '';
	@observable isPlayerCanCancel: boolean = false;

	constructor(root: RootController) {
		this.root = root;
		this.socket = root.socketController;
		fscreen.addEventListener('fullscreenchange', () => {
			this.isFullScreen = !!fscreen.fullscreenElement
		});
	}

	@computed get currentPlayer(): Player | null {
		if (!this.currentPlayerId) return null;
		return this.players[this.currentPlayerId] || null;
	}


	kickPlayer = (playerId) => {
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

	activatePlayerSelectMode = (notification) => {
		this.playersToSelect = notification.playersToSelect;
		this.notifications.splice(0, 1);
	};

	selectNotificationCardPreview = (index) => {
		if (this.cardInNotificationPreview === index) {
			this.cardInNotificationPreview = null;
		} else {
			this.cardInNotificationPreview = index;
		}
	}

	hidENotificationAction = () => {
		this.notifications.splice(0, 1);
	};

	selectCard = (notification, cardUniqueId) => {
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

	updateHand = (newHand) => {
		each(this.hand, card => {
			if (!newHand[card.uniqueId]) delete this.hand[card.uniqueId]
		});
		merge(this.hand, newHand)
	};

	updatePlayers = (newPlayers) => {
		merge(this.players, newPlayers);
		each(this.players, ({id}) => {
			if (!newPlayers[id]) {
				delete this.players[id];
			}
		})
	};

	updateHandActions = (handActions) => {
		this.handActions = handActions
	};

	updateGame = ({tradeContext, players, playersList, deck, gameLog, currentAction, state, currentPlayer, hand, handActions, hostPlayerId, isPlayerCanCancel}) => {
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

	backToLauncher = () => {
		this.socket.sendToServer(EClientEventType.leaveGame, {})
		this.root.launcherController.state = EAsyncState.idle;
		this.root.state = EAppState.launcher;
	}

	actionCancel = () => {
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.actionCancel});
	}

	changePlayerMark = (playerId) => {
		this.socket.sendToServer(EClientEventType.markPlayer, {playerId});
	}
}
