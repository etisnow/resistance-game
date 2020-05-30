import {Game} from "server/models/Game";
import {Player} from "server/models/Player";
import {EPlayerActionType} from 'shared/enum/playerActions';
import socketIO from "socket.io";
import {formatCommonError, formatLobbyState} from 'server/formatters/formatOutgoingEvents';
import {
  isPlayerCanActCard,
  isPlayerCanDiscardCard,
  isPlayerCanSelectCard,
  isPlayerCanSelectDesicion,
  isPlayerCanSelectPlayer,
  isPlayerCanTradeCard,
} from 'server/helpers/validators';
import {debugLog} from 'server/helpers/util';
import {each, find, isFunction, some} from 'lodash';
import {EGameState} from 'shared/enum/common';


class GameServer {
  games: { [key: string]: Game } = {};
  //players: { [key: string]: Player } = {};
  sockets: Map<socketIO.Socket, Player | null>;
  isMock: boolean = false;
  ignoreChecks: boolean = false;
  io: any;
  initialize(io) {
    this.io = io;
    this.sockets= new Map<socketIO.Socket, Player|null>();
  }


  initSocket(socket: socketIO.Socket) {
    this.sockets.set(socket, null);
    this.notifySocket(socket, formatLobbyState(gameServer));
    return socket;
  }

  getPlayerBySocket(socket: socketIO.Socket) {
    return this.sockets.get(socket) || null;
  }

  spawnPlayer(socket:socketIO.Socket) {
    const player = new Player({socket})
    this.sockets.set(socket, player);
    return player
  }

  createGame({ socket, nickname }: { socket: socketIO.Socket; nickname: string }): [Game, Player] {
    const player = this.spawnPlayer(socket);
    const game = new Game({ player });
    game.hostPlayerId = player.id;
    player.isReady = true;
    player.register({ nickname, game });
    this.games[game.id] = game;
    this.updateLobby();
    return [game, player];
  }
  leaveGame({ player }: { player: Player }) {
    const game = player.game;
    if (game) {
      game.playerLeave({player});
    }
  }

  updateLobby = () => {
    this.sockets.forEach((player, socket) => {
      if (!player) {
        this.notifySocket(socket, formatLobbyState(gameServer));
      }
    })
  };



  reconnectPlayer = (connectedPlayer: Player, socket: socketIO.Socket) => {
    connectedPlayer.isConnected = true;
    connectedPlayer.socket = socket;
    this.sockets.set(socket, connectedPlayer);
    connectedPlayer.game.updateGame();
    return connectedPlayer;
  };

  notifySocket(socket, event) {
    socket.emit(event.type, event.payload);
  }

  tryReconnectPlayer = (game, socket, nickname, connectedPlayer) : null | Player => {
    if (game.state === EGameState.sarted) {
      if (!connectedPlayer || !connectedPlayer.socket.disconnected) {
        this.notifySocket(socket, formatCommonError(`Игрок с ником ${nickname} еще онлайн.`))
        return null;
      }
      return this.reconnectPlayer(connectedPlayer, socket);
    } else {
      if (connectedPlayer && !connectedPlayer.socket.disconnected) {
        this.notifySocket(socket, formatCommonError(`Игрок с ником ${nickname} уже зарегистрирован в этой игре и находится онлайн. Если это вы -выйдите с другого устройства.`))
        return null;
      }
      if (!connectedPlayer) return null;
      return this.reconnectPlayer(connectedPlayer, socket);
    }
  };

  connectGame({nickname, socket, gameId}: { socket: socketIO.Socket; nickname: string, gameId: string }) : Player | null {
    const parsedGameId = gameId.trim();
    const game = this.games[parsedGameId] || this.games['game_' + parsedGameId];
    if (!game) return;
    const connectedPlayer = find(game.players, {nickname});
    if (connectedPlayer) {
      return this.tryReconnectPlayer(game, socket, nickname, connectedPlayer);
    } else if (game.state === EGameState.sarted) {
      const error = formatCommonError(`Игрок с ником ${nickname} не был найден в этой игре, а она уже началась.`)
      this.notifySocket(socket, error);
      return null;
    }
    const newPlayer = this.spawnPlayer(socket);
    newPlayer.register({ nickname, game });
    return newPlayer;
  }

  toggleReady({player}: { player: Player}) {
    player.toggleReady();
  }

  startGame({player}: {player:Player}) {
    if (!!some(player.game.players, {isReady: false})) {
      debugLog('Игроки не готовы')
      return;
    }
    player.game.start();
  }

  forceStartGame({player}: {player:Player}) {
    each(player.game.players, (pl) => {
      pl.isReady = true;
    });
    player.game.start();
  }


  findPlayerById(playerId) {
    let player = null;
    this.sockets.forEach((pl) => {
      if (!pl || pl.id !== playerId) return;
      player = pl;
    });
    return player;
  }
  kickPlayer({playerId}) {
    const player = this.findPlayerById(playerId);
    if (!player) return;
    const game = player.game;
    game.kickPlayer({player, notify: `Хост исключил тебя из игры`});
  }

  destroyGame(id) {
    if (this.games[id]) {
      delete this.games[id]
    }
    this.updateLobby();
  }

  playerAction({
    player,
    actionType,
    selectedPlayerId,
    cardUniqueId,
    action
  }: {
    player:Player,
    actionType: EPlayerActionType,
    cardUniqueId?: string,
    selectedPlayerId?:string,
    action?: string
  }) {
    const game = player.game;
    if (game) {
      switch(actionType) {
        case EPlayerActionType.cardAct:
          if (!isPlayerCanActCard(game, player, cardUniqueId)) {
            debugLog(`Игрок ${player.nickname} не может discard ${cardUniqueId}`);
            return;
          }
          break;
        case EPlayerActionType.cardDiscard:
          if (!isPlayerCanDiscardCard(game, player, cardUniqueId)) {
            debugLog(`Игрок ${player.nickname} не может act ${cardUniqueId}`);
            return;
          }
          break;
        case EPlayerActionType.cardTrade:
          if (!isPlayerCanTradeCard(game, player, cardUniqueId)) {
            debugLog(`Игрок ${player.nickname} не может торговать ${cardUniqueId}`);
            return;
          }
          break;
        case EPlayerActionType.playerSelect:
          if (!isPlayerCanSelectPlayer(game, player, selectedPlayerId)) {
            debugLog(`Игрок ${player.nickname} не выбрать игрока ${selectedPlayerId}`);
            return;
          }
          break;
        case EPlayerActionType.cardSelect:
          if (!isPlayerCanSelectCard(game, player, cardUniqueId)) {
            debugLog(`Игрок ${player.nickname} не выбрать карту ${cardUniqueId}`);
            return;
          }
          break;
        case EPlayerActionType.actionDecision:
          if (!isPlayerCanSelectDesicion(game, player, action)) {
            debugLog(`Игрок ${player.nickname} не решить ${action}`);
            return;
          }
          break;
      }
    }
    player.game.cardAction({player, actionType, cardUniqueId, selectedPlayerId, action})
  }

}

const gameServer = new GameServer();
export { gameServer, GameServer };
