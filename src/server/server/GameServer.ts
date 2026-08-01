import {Game} from "server/models/Game";
import {Player} from "server/models/Player";
import {EPlayerActionType} from 'shared/enum/playerActions';
import type {IGameSocket, IServerEvent, ISocketServer} from 'shared/interfaces/socket';
import {formatCommonError, formatLobbyState, formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {
  isPlayerCanActCard, isPlayerCanCancel,
  isPlayerCanDiscardCard,
  isPlayerCanSelectCard,
  isPlayerCanSelectDesicion,
  isPlayerCanSelectPlayer,
  isPlayerCanTradeCard,
} from 'server/helpers/validators';
import {debugLog} from 'server/helpers/util';
import {each, find, some} from 'lodash';
import {EGameState} from 'shared/enum/common';
import {gameHasBots, scheduleBots} from 'server/helpers/bot';
import {getCard, getPanic} from 'shared/constant/cards';
import {EEventID, EPanicID} from 'shared/enum/cards';

export interface IBotGameOptions {
  withBots?: boolean;
  seed?: number;
  firstPanic?: string;
  hand?: string[];
}


class GameServer {
  games: { [key: string]: Game } = {};
  sockets: Map<IGameSocket, Player | null> = new Map();
  isMock: boolean = false;
  ignoreChecks: boolean = false;
  io: ISocketServer | null = null;
  initialize(io: ISocketServer) {
    this.io = io;
    this.sockets = new Map<IGameSocket, Player | null>();
  }


  initSocket(socket: IGameSocket) {
    this.sockets.set(socket, null);
    this.notifySocket(socket, formatLobbyState(gameServer));
    return socket;
  }

  getPlayerBySocket(socket: IGameSocket) {
    return this.sockets.get(socket) || null;
  }

  spawnPlayer(socket: IGameSocket) {
    const player = new Player({socket})
    this.sockets.set(socket, player);
    return player
  }

  createGame({ socket, nickname, bots }: { socket: IGameSocket; nickname: string; bots?: IBotGameOptions }): [Game, Player] {
    const player = this.spawnPlayer(socket);
    const game = new Game({ player });
    game.hostPlayerId = player.id;
    player.isReady = true;
    player.register({ nickname, game });
    this.games[game.id] = game;
    this.updateLobby();
    if (bots?.withBots) {
      this.setupBotGame({ game, host: player, options: bots });
    }
    return [game, player];
  }

  // Dev mode (?withBots=true): fill the game with emulated opponents, start
  // immediately, optionally pin the seed and rig the human's hand / top panic,
  // then let the bot scheduler take over.
  private setupBotGame({ game, host, options }: { game: Game; host: Player; options: IBotGameOptions }) {
    if (typeof options.seed === 'number') game.reseed(options.seed);

    for (let i = 1; i <= 4; i++) {
      const bot = new Player({ socket: null });
      bot.isBot = true;
      bot.isReady = true;
      bot.register({ nickname: `Бот ${i}`, game });
    }

    game.start();

    // Rigging the hand breaks the dealt card-conservation invariant, so relax the
    // checks for this dev game.
    if (options.hand && options.hand.length > 0) {
      this.ignoreChecks = true;
      host.hand = options.hand
        .filter((id): id is EEventID => id !== EEventID.thing && Object.values(EEventID).includes(id as EEventID))
        .map((id) => getCard(id as EEventID));
      host.isInfected = host.hand.some((c) => c.id === EEventID.infect);
    }
    if (options.firstPanic && Object.values(EPanicID).includes(options.firstPanic as EPanicID)) {
      game.deck.unshift(getPanic(options.firstPanic as EPanicID));
    }

    // Let the human play first (so a rigged hand / first-drawn panic are
    // immediately in their hands), then hand off to the bot scheduler.
    game.changeTurn(host.id);
    game.updateGame();
    scheduleBots(this, game);
  }
  leaveGame({ player }: { player: Player }) {
    const game = player.game;
    if (game) {
      game.playerLeave({player});
    }
    this.releasePlayerSocket(player);
  }

  // Игрок вышел (или был исключён) — сокет снова «ничей». Без этого он навсегда
  // остаётся привязанным к игроку уже мёртвой игры, и клиент, вернувшийся в
  // лаунчер, показывает список комнат, замерший на момент входа в игру.
  releasePlayerSocket = (player: Player) => {
    const socket = player.socket;
    if (!socket) return;
    if (this.sockets.get(socket) !== player) return;
    this.sockets.set(socket, null);
    this.notifySocket(socket, formatLobbyState(gameServer));
  };

  // Шлём всем сокетам, а не только «свободным»: клиент может вернуться в лаунчер
  // в любой момент (выход, кик, конец игры), и список комнат к этому моменту
  // должен быть актуальным, а не тем, что был при входе в игру.
  updateLobby = () => {
    this.sockets.forEach((_player, socket) => {
      this.notifySocket(socket, formatLobbyState(gameServer));
    })
  };



  reconnectPlayer = (connectedPlayer: Player, socket: IGameSocket) => {
    connectedPlayer.isConnected = true;
    connectedPlayer.socket = socket;
    this.sockets.set(socket, connectedPlayer);
    connectedPlayer.game.updateGame();
    // Interactive prompts (select a card / player / decision) are one-shot
    // notification events that were lost while the player was offline. Re-send
    // the pending one so the selection overlay is restored on reconnect.
    if (connectedPlayer.currentAction) {
      connectedPlayer.notify(formatPlayerNotification({
        player: connectedPlayer,
        notification: connectedPlayer.currentAction,
      }));
    }
    return connectedPlayer;
  };

  notifySocket(socket: IGameSocket, event: IServerEvent) {
    socket.emit(event.type, event.payload);
  }

  tryReconnectPlayer = (game: Game, socket: IGameSocket, nickname: string, connectedPlayer: Player | null | undefined) : null | Player => {
    if (game.state === EGameState.sarted) {
      if (!connectedPlayer || !connectedPlayer.socket?.disconnected) {
        this.notifySocket(socket, formatCommonError(`Игрок с ником ${nickname} еще онлайн.`))
        return null;
      }
      return this.reconnectPlayer(connectedPlayer, socket);
    } else {
      if (connectedPlayer && !connectedPlayer.socket?.disconnected) {
        this.notifySocket(socket, formatCommonError(`Игрок с ником ${nickname} уже зарегистрирован в этой игре и находится онлайн. Если это вы -выйдите с другого устройства.`))
        return null;
      }
      if (!connectedPlayer) return null;
      return this.reconnectPlayer(connectedPlayer, socket);
    }
  };

  connectGame({nickname, socket, gameId}: { socket: IGameSocket; nickname: string, gameId: string }) : Player | null {
    const parsedGameId = gameId.trim();
    const game = this.games[parsedGameId] || this.games['game_' + parsedGameId];
    if (!game) {
      // Молча выйти нельзя: клиент уже показал лоадер и ждёт ответа, иначе он
      // висит в нём вечно. Ровно этот случай — клик по комнате, которой уже нет.
      this.notifySocket(socket, formatCommonError('Этой игры больше нет — комната закрылась.'));
      this.notifySocket(socket, formatLobbyState(gameServer));
      return null;
    }
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


  findPlayerById(playerId: string): Player | null {
    let player: Player | null = null;
    this.sockets.forEach((pl) => {
      if (!pl || pl.id !== playerId) return;
      player = pl;
    });
    return player;
  }
  kickPlayer({playerId}: {playerId: string}) {
    const player = this.findPlayerById(playerId);
    if (!player) return;
    const game = player.game;
    game.kickPlayer({player, notify: `Хост исключил тебя из игры`});
  }

  destroyGame(id: string) {
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
        case EPlayerActionType.actionCancel:
          if (!isPlayerCanCancel(game, player)) {
            debugLog(`Игрок ${player.nickname} не может отменить действие`);
            return;
          }
          break;
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
    // After a human move, resume the bots (no-op if it is still the human's turn
    // or there are no bots).
    if (game && !player.isBot && gameHasBots(game)) {
      scheduleBots(this, game);
    }
  }

  markPlayer({player, markPlayerId}: {player: Player | null, markPlayerId: string}) {
    if (!player) return;
    player.markPlayer(markPlayerId)
  }

}

const gameServer = new GameServer();
export { gameServer, GameServer };
