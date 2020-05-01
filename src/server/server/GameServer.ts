import { Game } from "server/models/Game";
import { Player } from "server/models/Player";
import {EPlayerActionType} from 'shared/enum/playerActions';
import {formatCommonError, formatLobbyState} from 'server/formatters/formatOutgoingEvents';
import {
  isPlayerCanActCard,
  isPlayerCanDiscardCard, isPlayerCanSelectCard, isPlayerCanSelectDesicion,
  isPlayerCanSelectPlayer,
  isPlayerCanTradeCard,
} from 'server/helpers/validators';
import {debugLog} from 'server/helpers/util';
import {some, find, each, isFunction} from 'lodash';
import {EGameState} from 'shared/enum/common';


class GameServer {
  games: { [key: string]: Game } = {};
  players: { [key: string]: Player } = {};
  isMock: boolean = false;
  io: any;
  initialize(io) {
    this.io = io;
  }

  broadcast = ({ roomName, event }) => {
    this.io.to(roomName).emit(event.type, event.payload);
  };

  getPlayerById(id) {
    return this.players[id] || null;
  }
  initPlayer(socket) {
    const player = new Player({ socket });
    this.players[player.id] = player;
    player.notify(formatLobbyState(gameServer));
    return player;
  }

  createGame({ player, nickname }: { player: Player; nickname: string }) {
    const game = new Game({ player });
    player.isHost = true;
    player.isReady = true;
    player.register({ nickname, game });
    this.games[game.id] = game;
    each(this.players, pl => {
      if (!pl.game) {
        pl.notify(formatLobbyState(gameServer));
      }
    })
    return game;
  }

  reconnectPlayer = (connectedPlayer, player: Player) => {
      //connectedPlayer.socket = player.socket;
      each(Object.keys(connectedPlayer), key => {
        if (key !== 'socket' && !isFunction(connectedPlayer[key])) {
          player[key] = connectedPlayer[key];
        }
      });
      player.isConnected = true;
      player.game.players[player.id] = player;
      player.game.updateGame();
  };

  tryReconnectPlayer = (game, player, nickname) : boolean => {
    const connectedPlayer = find(game.players, {nickname});
    console.log('CONNECTED PLAYER STATE DISCONNECTED',  connectedPlayer && connectedPlayer.socket.disconnected)
    if (game.state === EGameState.sarted) {
      if (!connectedPlayer || !connectedPlayer.socket.disconnected) {
        player.notify(formatCommonError(`Игрок с ником ${nickname} не был найден в этой игре или еще находится онлайн.`))
        return false;
      }
      this.reconnectPlayer(connectedPlayer, player);
      return true;
    } else {
      if (connectedPlayer && !connectedPlayer.socket.disconnected) {
        player.notify(formatCommonError(`Игрок с ником ${nickname} уже зарегистрирован в этой игре и находится онлайн. Если это вы -выйдите с другого устройства.`))
        return false;
      }
      if (!connectedPlayer) return false;
      this.reconnectPlayer(connectedPlayer, player);
      return true;
    }
  };

  connectGame({nickname, player, gameId}: { player: Player; nickname: string, gameId: string }) {
    const parsedGameId = gameId.trim();
    const game = this.games[parsedGameId] || this.games['game_' + parsedGameId];
    if (!game) return;
    const connectedPlayer = find(game.players, {nickname});
    if (connectedPlayer) {
      this.tryReconnectPlayer(game, player, nickname)
      return;
    }
    player.register({ nickname, game });
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

  kickPlayer({playerId}) {
    const player = this.getPlayerById(playerId);
    const game = player.game;
    game.disconnectPlayer({player});
    player.notify(formatCommonError(`Тебя исключили из игры`))
  }
  getGameById(id) {
    return this.games[id] || null;
  }
  destroyGame(id) {
    if (this.games[id]) {
      delete this.games[id]
    }
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
