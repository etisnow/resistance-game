import * as _ from 'lodash';
import {find, findIndex} from 'lodash';
import socketIO from "socket.io";
import {Game} from 'server/models/Game';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ICardEvent} from 'shared/interfaces/cards';
import {shuffle} from 'server/helpers/util';

export class Player {
	id = null;
	socket: socketIO.Socket;
	state: EPlayerState = EPlayerState.dummy;
	turnState: ETurnState = ETurnState.idle;
	nickname: string = '';
	isOnline: boolean = true;
	isHost: boolean = false;
	color:string = '';
	game: Game = null;
	isYou: boolean;
	hand: ICardEvent[];
	isInjured: boolean = false;
	isThing: boolean = false;
	quarantine: number = 0;

	constructor({ socket, playerState = EPlayerState.dummy }) {
		this.state = playerState;
		if (playerState === EPlayerState.door) {
			return;
		}
		//console.log("A user connected : " + socket.id);
		this.id = _.uniqueId('player_');
		this.socket = socket;
	}
	notify = (event) => {
		if (!this.socket) return;
		this.socket.emit(event.type, event.payload);
	};
	register = ({nickname, game}: {nickname:string, game: Game}) => {
		this.nickname = nickname;
		this.game = game;
		//console.log('connect player to the game')
		game.connectPlayer({player: this});
	};
	getCardById = (id) => {
		return find(this.hand, {id});
	};
	getCardByUniqueId = (uniqueId: string) : ICardEvent => {
		return find(this.hand, {uniqueId});
	};
	makeOffline = () => {
		this.isOnline = false;
	};

	changeTurnState = (newTurnState: ETurnState) => {
		this.turnState = newTurnState
	};

	getNeighbours = () => {
		const game = this.game;
		if (!game) { throw new Error('Не забиндена игра у игрока'); }
		const currentPlayerIndex = findIndex(game.playersList, (playerId) => this.id === playerId );
		const rightId = game.playersList[currentPlayerIndex + 1] || game.playersList[0];
		const leftId = game.playersList[currentPlayerIndex - 1] || game.playersList[game.playersList.length - 1];
		return [rightId, leftId];
	};

	getPlayabeNeighbours = (ignoreOptions?: { ignoreDoors:boolean, ignoreQuarantine:boolean }) => {
		const game = this.game;
		if (!game) { throw new Error('Не забиндена игра у игрока'); }
		const currentPlayerIndex = findIndex(game.playersList, (playerId) => this.id === playerId );
		const rightId = game.playersList[currentPlayerIndex + 1] || game.playersList[0];
		const leftId = game.playersList[currentPlayerIndex - 1] || game.playersList[game.playersList.length - 1];
		const rightPlayer = game.players[rightId];
		const leftPlayer = game.players[leftId];
		const nighbours = [rightPlayer, leftPlayer]
			.filter((p) => p.state !== EPlayerState.door && p.quarantine === 0)
			.map(p => p.id);
		return nighbours;
	};

	getRandomCard = () => {
		const randomCardArray = shuffle(this.hand);
		return randomCardArray[0];
	}
}
