import {Game} from "server/models/Game";
import {Player} from "server/models/Player";
import {EPlayerActionType} from 'shared/enum/playerActions';
import type {IGameSocket, IServerEvent, ISocketServer} from 'shared/interfaces/socket';
import {formatCommonError, formatLobbyState, formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {
  isPlayerCanActCard, isPlayerCanCancel,
  isPlayerCanDiscardCard,
  isPlayerCanSelectCards,
  isPlayerCanSelectDesicion,
  isPlayerCanSelectPlayer,
  isPlayerCanTradeCard,
} from 'server/helpers/validators';
import {debugLog} from 'server/helpers/util';
import {each, find, map, some} from 'lodash';
import {EGameState} from 'shared/enum/common';
import {gameHasBots, scheduleBots} from 'server/helpers/bot';
import {getCard, getPanic} from 'shared/constant/cards';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {EGameLogType} from 'shared/enum/gameLogType';
import {submitMatch} from 'server/analytics/track';
import {EAnalyticsSource} from 'shared/analytics/contract';

export interface IBotGameOptions {
  withBots?: boolean;
  seed?: number;
  firstPanic?: string;
  hand?: string[];
  botCount?: number;
}

// Сколько ботов сажать за стол в дев-режиме, если ?botCount= не задан.
const DEFAULT_BOT_COUNT = 5;
// Колода собирается под 4..12 игроков (карты фильтруются по playersCount, а
// бейджей на столе 11 + человек), поэтому число ботов зажимаем в эти рамки:
// меньше трёх — колода почти пустая, больше одиннадцати — за столом некому сесть.
const MIN_BOT_COUNT = 3;
const MAX_BOT_COUNT = 11;

// Значение приходит из URL, поэтому нормализуем: мусор и дроби превращаем в
// дефолт/целое, а всё остальное зажимаем в поддерживаемый диапазон.
export const botGameBotCount = (requested?: number): number => {
  if (typeof requested !== 'number' || !Number.isFinite(requested)) return DEFAULT_BOT_COUNT;
  return Math.min(MAX_BOT_COUNT, Math.max(MIN_BOT_COUNT, Math.floor(requested)));
};

// Ник — единственный идентификатор человека между подключениями: клиент хранит
// его локально и присылает при каждом входе. Сравниваем без учёта регистра и
// краевых пробелов, иначе «Вася» и «вася » окажутся разными людьми.
const sameNickname = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();


class GameServer {
  games: { [key: string]: Game } = {};
  sockets: Map<IGameSocket, Player | null> = new Map();
  isMock: boolean = false;
  ignoreChecks: boolean = false;
  // Чем помечать партии этого сервера в аналитике. Нужен тестовым стендам,
  // которые играют в РЕАЛЬНОМ режиме (фаззер): по isMock их не отличить от
  // живой игры, а их партиям в публичной статистике делать нечего.
  analyticsSource: EAnalyticsSource | null = null;
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

  // Живая игра, хостом которой является человек с этим ником (у одного человека
  // она может быть только одна — см. createGame).
  findGameHostedByNickname(nickname: string): Game | null {
    return find(this.games, (game) => {
      if (!game.gameInProcess) return false;
      const host = game.players[game.hostPlayerId];
      return !!host && sameNickname(host.nickname, nickname);
    }) || null;
  }

  // Закрыть комнату и вернуть всех живых людей в лаунчер.
  private dropGame(game: Game, reason: string) {
    each(game.players, (player) => {
      if (player.isBot) return;
      if (player.socket) this.notifySocket(player.socket, formatCommonError(reason));
      this.releasePlayerSocket(player);
    });
    this.destroyGame(game.id);
  }

  // Сокет уже сидит в другой комнате (двойной клик, зависший клиент, вторая
  // вкладка) — выпускаем его оттуда, иначе игрок останется там призраком.
  private leaveCurrentGame(socket: IGameSocket, exceptGame?: Game) {
    const currentPlayer = this.getPlayerBySocket(socket);
    if (!currentPlayer || !currentPlayer.game) return;
    if (exceptGame && currentPlayer.game === exceptGame) return;
    this.leaveGame({player: currentPlayer});
  }

  // Человек занимает ровно одно место: его тёзки-призраки в остальных комнатах
  // уходят вместе с ним. Иначе брошенная вкладка так и висит там «в онлайне», и
  // комната ждёт игрока, которого нет.
  private releaseOtherSeats(nickname: string, keepGame: Game) {
    each(Object.values(this.games), (game) => {
      if (game === keepGame || !game.gameInProcess) return;
      const ghost = find(game.players, (p) => !p.isBot && sameNickname(p.nickname, nickname));
      if (!ghost) return;
      this.leaveGame({player: ghost});
    });
  }

  createGame({ socket, nickname, bots }: { socket: IGameSocket; nickname: string; bots?: IBotGameOptions }): [Game, Player] {
    const hostedGame = this.findGameHostedByNickname(nickname);
    const previousHost = hostedGame ? hostedGame.players[hostedGame.hostPlayerId] : undefined;
    if (hostedGame && previousHost) {
      if (bots?.withBots) {
        // Дев-режим с ботами: человек в комнате один, старую просто закрываем,
        // чтобы каждый запуск начинался с чистой игры.
        this.dropGame(hostedGame, 'Твоя предыдущая игра с ботами закрыта.');
      } else {
        // Одна игра на человека: повторное «Создай игру» с тем же ником не
        // плодит комнаты, а возвращает хоста в его собственную — после рефреша,
        // из другой вкладки или с другого устройства.
        const host = this.reconnectPlayer(previousHost, socket);
        this.releaseOtherSeats(nickname, hostedGame);
        return [hostedGame, host];
      }
    }
    this.leaveCurrentGame(socket);
    const player = this.spawnPlayer(socket);
    const game = new Game({ player });
    game.hostPlayerId = player.id;
    player.isReady = true;
    player.register({ nickname, game });
    this.games[game.id] = game;
    this.releaseOtherSeats(nickname, game);
    this.updateLobby();
    if (bots?.withBots) {
      this.setupBotGame({ game, host: player, options: bots });
    }
    return [game, player];
  }

  // Dev mode (?withBots=true): fill the game with emulated opponents, start
  // immediately, optionally pin the seed and rig the human's hand / top panic,
  // then let the bot scheduler take over. Число ботов — ?botCount= (по умолчанию
  // DEFAULT_BOT_COUNT).
  private setupBotGame({ game, host, options }: { game: Game; host: Player; options: IBotGameOptions }) {
    if (typeof options.seed === 'number') game.reseed(options.seed);

    const botCount = botGameBotCount(options.botCount);
    for (let i = 1; i <= botCount; i++) {
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
    const previousSocket = connectedPlayer.socket;
    if (previousSocket && previousSocket !== socket) {
      // Старое подключение перестаёт быть этим игроком СРАЗУ, не дожидаясь его
      // disconnect. Иначе отложенный (до pingTimeout, а то и вовсе не
      // приходящий) разрыв старой вкладки пометит только что вернувшегося
      // игрока офлайн, а комнату — брошенной.
      this.sockets.delete(previousSocket);
      this.notifySocket(previousSocket, formatCommonError(
        `Игрок с ником ${connectedPlayer.nickname} вошёл в игру заново — это подключение больше не в игре.`,
      ));
      this.notifySocket(previousSocket, formatLobbyState(this));
    }
    connectedPlayer.isConnected = true;
    connectedPlayer.socket = socket;
    this.sockets.set(socket, connectedPlayer);
    const game = connectedPlayer.game;
    // Хост в лобби всегда готов (как при создании игры): иначе после его
    // возвращения игру нельзя начать, пока он не нажмёт «я готов».
    if (game.state === EGameState.lobby && game.hostPlayerId === connectedPlayer.id) {
      connectedPlayer.isReady = true;
    }
    game.addLog(`Игрок ${connectedPlayer.nickname} вернулся в игру`, EGameLogType.system);
    game.updateGame();
    this.updateLobby();
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

  // Один ник — один человек: новое подключение всегда ЗАМЕЩАЕТ старый инстанс
  // игрока (другая вкладка, другое устройство, зависшая сессия), а не отбивается
  // ошибкой «игрок ещё онлайн». Старая проверка опиралась на socket.disconnected,
  // но сервер узнаёт о разрыве с задержкой (а при потере сети — только по
  // pingTimeout, если вообще), и человек не мог вернуться в игру, в которой он
  // точно играет.
  tryReconnectPlayer = (_game: Game, socket: IGameSocket, _nickname: string, connectedPlayer: Player | null | undefined) : null | Player => {
    if (!connectedPlayer) return null;
    return this.reconnectPlayer(connectedPlayer, socket);
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
    const connectedPlayer = find(game.players, (player) => !player.isBot && sameNickname(player.nickname, nickname));
    if (connectedPlayer) {
      const player = this.tryReconnectPlayer(game, socket, nickname, connectedPlayer);
      if (player) this.releaseOtherSeats(nickname, game);
      return player;
    } else if (game.state === EGameState.sarted) {
      const error = formatCommonError(`Игрок с ником ${nickname} не был найден в этой игре, а она уже началась.`)
      this.notifySocket(socket, error);
      return null;
    }
    this.leaveCurrentGame(socket, game);
    const newPlayer = this.spawnPlayer(socket);
    newPlayer.register({ nickname, game });
    this.releaseOtherSeats(nickname, game);
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


  // Ищем по комнатам, а не только по сокетам: у отключившегося игрока живого
  // сокета уже нет, но исключить его хост должен уметь.
  findPlayerById(playerId: string): Player | null {
    const inGame = find(map(this.games, (game) => game.players[playerId]), (pl): pl is Player => !!pl);
    if (inGame) return inGame;
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
    const game = this.games[id];
    if (game) {
      // Комнату закрыли, не доиграв (хост вышел, все отвалились). Партия всё
      // равно уезжает в аналитику — но помеченной как брошенная, чтобы не
      // портить статистику побед. Доигранные партии сюда приходят уже
      // отправленными (Game.end), и рекордер их не продублирует.
      if (game.gameInProcess) {
        submitMatch(game, {endMessage: 'Партия не доиграна', isComplete: false});
      }
      // Помечаем игру завершённой, иначе привязанные к ней таймеры (боты)
      // продолжают ходить в комнате-призраке.
      game.gameInProcess = false;
      delete this.games[id]
    }
    this.updateLobby();
  }

  playerAction({
    player,
    actionType,
    selectedPlayerId,
    cardUniqueId,
    cardUniqueIds,
    action
  }: {
    player:Player,
    actionType: EPlayerActionType,
    cardUniqueId?: string,
    cardUniqueIds?: string[],
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
        case EPlayerActionType.cardsSelect:
          if (!isPlayerCanSelectCards(game, player, cardUniqueIds)) {
            debugLog(`Игрок ${player.nickname} не может выбрать карты ${cardUniqueIds}`);
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
    player.game.cardAction({player, actionType, cardUniqueId, cardUniqueIds, selectedPlayerId, action})
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
