import * as _ from 'lodash';
import {findIndex} from 'lodash';
import {Game} from 'server/models/Game';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {debugLog} from 'server/helpers/util';
import INotificationAction from 'shared/interfaces/notification';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatUpdateGameEvent} from 'server/formatters/formatOutgoingEvents';
import {EPlayerMark} from 'shared/enum/playerMarks';
import type {IGameSocket, IServerEvent} from 'shared/interfaces/socket';

export class Player {
	// Real players get a unique id; the door placeholder keeps '' (it is
	// identified by state === door, never looked up by id).
	id: string = '';
	socket: IGameSocket | null = null;
	state: EPlayerState = EPlayerState.dummy;
	turnState: ETurnState = ETurnState.idle;
	nickname: string = '';
	color: string = '';
	// Номер лица в списке аватарок (см. resources.avatars). Раздаётся на старте
	// партии, по одному на человека — им и залит его кружок за столом.
	avatar: string = '';
	// Always assigned via register() before the player participates in a game.
	game!: Game;
	isYou: boolean = false;
	// Роль. Раздаётся на старте партии (см. gameStarter) и до развязки наружу
	// уходит только своим: шпионы знают друг друга, сопротивление не знает никого.
	isSpy: boolean = false;
	isReady: boolean = false;
	// True for server-driven emulated opponents (the ?withBots=true dev mode).
	isBot: boolean = false;
	currentAction: INotificationAction | null = null;
	isConnected: boolean = true;
	marks: {[key: string]: EPlayerMark} = {};

	constructor({ socket, playerState = EPlayerState.dummy }: { socket?: IGameSocket | null; playerState?: EPlayerState }) {
		this.state = playerState;
		if (playerState === EPlayerState.door) {
			return;
		}
		this.id = _.uniqueId('player_');
		this.socket = socket ?? null;
	}

	notify = (event: IServerEvent) => {
		if (event.type === 'notification') {
			this.processNotificationAction(event.payload as INotificationAction);
		}
		if (!this.socket) return;
		this.socket.emit(event.type, event.payload);
	};

	// Вопрос, на который стол ждёт ответа именно от этого игрока. Держим его на
	// игроке, а не только в сокет-событии: одноразовое событие теряется, пока
	// игрок офлайн, и вернувшемуся его надо переслать заново (см. reconnectPlayer).
	processNotificationAction(notificationAction: INotificationAction) {
		switch (notificationAction.type) {
			case ENotificationAction.actionDecision:
			case ENotificationAction.playerSelect:
				this.currentAction = notificationAction;
				return
		}
	}

	changeTurnState = (newTurnState: ETurnState) => {
		if (!this.game.gameInProcess) return;
		if (this.state === EPlayerState.door) return;
		if (this.turnState === newTurnState) return;
		debugLog(`Игрок ${this.nickname} теперь ${newTurnState}`)
		this.turnState = newTurnState
		if (newTurnState === ETurnState.idle) this.currentAction = null;
	};

	isAlive() {
		return this.state !== EPlayerState.door;
	}

	register = ({nickname, game}: {nickname: string, game: Game}) => {
		this.nickname = nickname;
		this.game = game;
		game.connectPlayer({player: this});
	};

	makeOffline = () => {
		this.isConnected = false;
		if (this.game) {
			this.game.disconnectPlayer({player: this})
		}
	};

	private neighbourIds = (): string[] => {
		const game = this.game;
		if (!game) { throw new Error('Не забиндена игра у игрока'); }
		const i = findIndex(game.playersList, (playerId) => this.id === playerId);
		const rightId = game.playersList[i + 1] ?? game.playersList[0];
		const leftId = game.playersList[i - 1] ?? game.playersList[game.playersList.length - 1];
		return [rightId, leftId].filter((id): id is string => !!id);
	};

	getNeighbours = (): string[] => this.neighbourIds();

	getNextPlayer = (): Player => {
		if (!this.game) {
			debugLog('GAME Не задан у игрока', this.nickname)
			throw new Error('Не забиндена игра у игрока')
		}
		return this.game.getPlayerByPosition({playerId: this.id, isNext: true});
	}

	getPrevPlayer = (): Player => {
		return this.game.getPlayerByPosition({playerId: this.id, isNext: false});
	}

	toggleReady = () => {
		this.isReady = !this.isReady;
		this.game.updateGame();
	}

	// Метки — личные заметки игрока о соседях по столу: кто «свой», кто под
	// вопросом, кто шпион. Видит их только он сам, наружу они не уходят.
	markPlayer = (markPlayerId: string) => {
		const previousMark = this.marks[markPlayerId];
		this.marks[markPlayerId] = getNextMark(previousMark);
		this.notify(formatUpdateGameEvent({game: this.game, viewer: this}));
	}

}


function getNextMark(currentMark: EPlayerMark | undefined) {
	switch (currentMark) {
		case undefined:
			return EPlayerMark.clear;
		case EPlayerMark.clear:
			return EPlayerMark.question;
		case EPlayerMark.question:
			return EPlayerMark.infected;
		case EPlayerMark.infected:
			return EPlayerMark.thing;
		case EPlayerMark.thing:
			return EPlayerMark.none;

	}
	return EPlayerMark.clear;
}
