import {each, filter, find, uniqueId} from "lodash";
import {Player} from "server/models/Player";
import {gameServer} from 'server/server/GameServer';
import {
  formatCommonError,
  formatPlayerNotification,
  formatStartGameEvent,
  formatUpdateGameEvent,
} from 'server/formatters/formatOutgoingEvents';
import {gameStarter} from 'server/helpers/gameStarter';
import {debugLog, mulberry32} from 'server/helpers/util';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import INotificationAction from 'shared/interfaces/notification';
import {ENotificationAction} from 'shared/enum/notifications';
import clc from 'cli-color';
import {EGameState} from 'shared/enum/common';
import type {IServerEvent} from 'shared/interfaces/socket';
import {EGameLogType} from 'shared/enum/gameLogType';
import type {IGameLogEntry} from 'shared/interfaces/gameLog';

export class Game {
  id: string = '';
  state: EGameState = EGameState.lobby;
  players: { [key: string]: Player } = {};
  playersList: string[] = [];
  // Чей сейчас ход. В «Сопротивлении» это лидер раунда: стол наводит на него
  // прицел и от него же рисует стрелки к набранной команде.
  turnPlayerId: string | null = null;
  isClockwise: boolean = true;
  hostPlayerId: string = '';
  gameLog: IGameLogEntry[] = [];
  gameInProcess: boolean = true;
  // Every game runs on its own seeded RNG so the whole game is reproducible from
  // this one number (logged as the first game-log line). A bug report's log is
  // enough to replay the exact deal. Override before start() via reseed().
  seed: number = 0;
  rng: () => number = Math.random;

  constructor({ player }: { player: Player }) {
    this.id = uniqueId("game_");
    this.players[player.id] = player;
    this.reseed(Math.floor(Math.random() * 0xffffffff));
  }

  reseed = (seed: number) => {
    this.seed = seed >>> 0;
    this.rng = mulberry32(this.seed);
  };

  notifyAllPlayers = (event: IServerEvent) => {
    each(this.players, (p) => {
      p.notify(event);
    })
  };

  notifyAllPlayersExeptPlayer = (event: IServerEvent, player: Player) => {
    each(this.players, (p) => {
      if (p === player) return;
      p.notify(event);
    })
  };

  notifyPlayer = ({player, notification} : {player: Player, notification: INotificationAction}) => {
    player.notify(formatPlayerNotification({ player, notification }));
  }

  connectPlayer({ player }: {player: Player}) {
    this.players[player.id] = player;
    this.playersList.push(player.id);
    this.updateGame();
    // Состав комнаты поменялся — в лаунчере обновится счётчик игроков.
    gameServer.updateLobby();
  }

  kickPlayer = ({ player, notify = `Тебя исключили из игры`}: {player: Player, notify: string | null}) => {
    delete this.players[player.id];
    this.playersList = this.playersList.filter(p => p !== player.id)
    if (notify) {
      player.notify(formatCommonError(notify));
    }
    gameServer.releasePlayerSocket(player);
    this.updateGame();
    gameServer.updateLobby();
  }

  disconnectPlayer({ player }: {player: Player}) {
    this.addLog(`Игрок ${player.nickname} отключился от игры. Ждем его возвращения`, EGameLogType.system)
    player.isReady = false;
    // Боты «подключены» всегда, поэтому комнату живой они считаться не могут:
    // иначе брошенная дев-игра с ботами живёт вечно и висит в списке комнат.
    const activePlayer = find(this.players, (p) => p.isConnected && !p.isBot && p.state === EPlayerState.dummy);
    if (activePlayer) {
      return this.updateGame();
    }
    this.destroy();
  }

  updateGame = () => {
    if (!this.gameInProcess) return;
    each(this.players, (player: Player) => {
      player.notify(formatUpdateGameEvent({game: this, viewer: player}))
    })
  };

  addLog(log: string, type: EGameLogType = EGameLogType.info, force = false) {
    if (this.gameInProcess || force) {
      debugLog(clc.yellowBright(log))
      this.gameLog.push({text: log, type})
    }
  }

  // Развязка. isSpiesWin отдельным полем, а не по тексту сообщения: текст — фраза
  // для игрока, и переписать её должно быть можно, не сломав то, что от исхода
  // зависит (сейчас — звук развязки).
  end = (lastMessage: string, {isSpiesWin = false}: {isSpiesWin?: boolean} = {}) => {
    const anyPlayer = this.players[this.hostPlayerId] ?? find(this.players);
    if (anyPlayer) {
      this.notifyAllPlayers(formatPlayerNotification({
        player: anyPlayer,
        notification: {
          type: ENotificationAction.gameEnd,
          isSpiesWin,
          menu: [{
            action: 'exit',
            text: 'Выход',
          }, {
            action: 'hide',
            text: 'Скрыть',
          }],
          text: lastMessage,
        },
      }));
    }

    this.addLog(lastMessage ? lastMessage : 'Игра закончена.', EGameLogType.system, true)

    // Стол разбирают до последнего кадра: партия кончилась, значит ничей ход не
    // идёт (прицел наводить не на кого) и ни от кого ничего не ждут. Всё это
    // живёт ровно до следующего обновления, а его уже не будет — что осталось в
    // этом кадре, то и застынет на столе.
    this.turnPlayerId = null;
    each(this.playersList, (pId) => {
      const pl = this.players[pId];
      if (!pl) return;
      pl.currentAction = null;
      pl.changeTurnState(ETurnState.idle);
    });
    // Последний кадр стола. Он обязан уйти ДО gameInProcess = false: дальше
    // updateGame молча выходит, и всё, что случилось этим же ходом, до клиентов
    // уже не доедет.
    this.updateGame();
    this.gameInProcess = false;
    gameServer.destroyGame(this.id)
  };

  start = () => {
    const players = this.players;
    debugLog('============================================================');
    // First line of the log is the seed — a bug report's log alone is enough to
    // reproduce the exact deal.
    this.addLog(`Сид игры: ${this.seed}`, EGameLogType.system);
    this.addLog('Игра началась', EGameLogType.system);
    this.state = EGameState.sarted;
    gameStarter(this);
    const firstPlayerId = this.playersList[0];
    if (firstPlayerId) this.turnPlayerId = firstPlayerId;
    this.notifyAllPlayers(formatStartGameEvent({players}))
    this.updateGame();
    // Комната перешла в «идёт игра» — список в лаунчере должен это показать.
    gameServer.updateLobby();
  };

  // Игроки сидят по кругу, и обход по кругу нужен всему: лидер передаётся
  // следующему, счёт мест идёт от него же.
  getPlayerByPosition = ({playerId, isNext}: {playerId: string, isNext: boolean}) : Player => {
    const currentPlayerIndex = this.playersList.indexOf(playerId);

    const clockwiseNext = this.playersList[currentPlayerIndex + 1] ?? this.playersList[0];
    const clockwisePrev = this.playersList[currentPlayerIndex - 1] ?? this.playersList[this.playersList.length - 1];

    let getPlayerId: string | undefined;
    if (this.isClockwise) {
      getPlayerId = isNext ? clockwiseNext : clockwisePrev;
    } else {
      getPlayerId = isNext ? clockwisePrev : clockwiseNext;
    }

    const player = getPlayerId ? this.players[getPlayerId] : undefined;
    if (!player) {
      throw new Error('Не удалось получить игрока по позиции');
    }
    return player;
  };

  // Все, кто сидит за столом. Двери — служебные места, а не участники.
  seatedPlayers = (): Player[] =>
    filter(
      this.playersList.map((pId) => this.players[pId]),
      (p): p is Player => !!p && p.state !== EPlayerState.door,
    );

  destroy() {
    gameServer.destroyGame(this.id);
  }

  playerLeave({player}: {player: Player}) {
    // Игра уже закончена: остальные могут дочитывать лог, и выгонять их за компанию
    // с уходящим хостом не надо — просто отпускаем этого игрока.
    if (!this.gameInProcess) {
      delete this.players[player.id];
      this.playersList = this.playersList.filter(p => p !== player.id);
      return;
    }
    this.kickPlayer({player, notify: null})
    if (player.id === this.hostPlayerId) {
      each(this.players, (pl) => {
        if (pl !== player) {
          this.kickPlayer({player: pl, notify: `Хост вышел из игры`})
        }
      });
      this.destroy();
    }
    this.updateGame();
  }

}
