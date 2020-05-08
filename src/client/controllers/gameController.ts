import {action, computed, observable} from "mobx";
import SocketController from 'client/controllers/socketController';
import Player from 'client/models/Player';
import INotificationAction from 'shared/interfaces/notification';
import RootController from 'client/controllers/rootController';
import {ECardType} from 'shared/enum/cards';
import {EGameState} from 'shared/enum/common';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {IFormatTradeContext} from 'shared/interfaces/common';
import fscreen from 'fscreen';
import { each, merge, difference, keys, find } from "lodash";

export default class GameController {
	root: RootController;
	socket: SocketController;

	@observable state: EGameState = EGameState.lobby;
	@observable id : string | null = null;
	@observable players: {[key: string]: any | null } = {};
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
	}

	cardAction = (actionType: EPlayerActionType, cardUniqueId: string) => {
		this.socket.sendToServer(EClientEventType.playerAction, {actionType, cardUniqueId})
	};

	activatePlayerSelectMode = (notification) => {
		this.playersToSelect = notification.playersToSelect;
		this.notifications.splice(0, 1);
	};

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

	actionDecision = (action: string ) => {
		this.playersToSelect = [];
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.actionDecision, action});
		this.hidENotificationAction();
	};
	toggleRoomLayout = () => {
		this.isLayoutSequential = !this.isLayoutSequential;
	}

	updatePlayers = (newPlayers) => {
		//if (!this.players) this.players = {};
		//merge(this.players, newPlayers);
		//return;
		//this.players = newPlayers
		each(newPlayers, (pl,pId) => {
			if (!this.players[pId]) this.players[pId] = pl;
			merge(this.players[pId], pl)

			this.players[pId].hand = pl.hand
		})
		//console.log(this.players)
		//this.players = newPlayers;
/*
		each(newPlayers, (pl, pId) => {
			const playerToUpdate = this.players[pId]
			each(pl.hand, (card, cardIndex) => {
/!*				const cardToUpdate = find(playerToUpdate.hand, {uniqueId: card.uniqueId});
				if (cardToUpdate) {
					console.log('test')
					merge(this.players[pId].hand[cardIndex], card)
				} else {
					this.players[pId].hand.push(card)
				}*!/

				each(this.players[pId].hand, (existingCard, exCid: number) => {
					const isUpdatedCardExists = find(pl.hand, {uniqueId: existingCard.uniqueId});
					if (!isUpdatedCardExists) {
						console.log({exCid})
						this.players[pId].hand.splice(exCid - 1,1)
					}
				})
			})
			//this.players[pId].hand = pl.hand*/

		//})
/*		difference(keys(this.players), keys(newPlayers)).forEach(k => delete this.players[k])
		each(newPlayers, (pl, pId) => {
			console.log(pl, this.players[pId])
			if (this.players[pId]) {
				this.players[pId].hand = pl.hand;
			} else {
				this.players = newPlayers
			}
		})*/
		//this.players = newPlayers
		//each(newPlayers, (oldPlayer, id) => {
		//	this.players[id] = merge(this.players[id], newPlayers[id])
		//})
	}

	toggleFullScreen = () => {
		if (!fscreen.fullscreenEnabled) return;
		if (!this.isFullScreen) {
			fscreen.requestFullscreen(document.getElementById("root"));
		} else {
			fscreen.exitFullscreen();
		}
		//this.is = !this.isLayoutSequential;
	}
}
