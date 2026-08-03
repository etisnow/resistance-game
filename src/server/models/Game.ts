import {clone, each, filter, find, map, uniqueId} from "lodash";
import {Player} from "server/models/Player";
import {gameServer} from 'server/server/GameServer';
import {
  formatCommonError,
  formatPlayerNotification,
  formatStartGameEvent,
  formatUpdateGameEvent,
} from 'server/formatters/formatOutgoingEvents';
import {gameStarter} from 'server/helpers/gameStarter';
import {debugLog, mulberry32, shuffle} from 'server/helpers/util';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {thingCard} from 'shared/constant/cards';
import {EPlayerActionType} from 'shared/enum/playerActions';
import INotificationAction from 'shared/interfaces/notification';
import {ICardAny, ICardEvent, ICardPanic} from 'shared/interfaces/cards';
import {actCard, playerActionDecision, selectCards, selectPlayer, viewConfirm} from 'server/helpers/playerAction';
import {ITurnContext} from 'shared/interfaces/turnContext';
import {tradeCard} from 'server/helpers/tradeCard';
import {discardCardAction} from 'server/helpers/discardCard';
import {ECardType} from 'shared/enum/cards';
import {panicAction} from 'server/helpers/panicActions';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {chainReactionTrade} from 'server/helpers/cardActions/panic/chainReaction';
import {ENotificationAction} from 'shared/enum/notifications';
import {checkAllDeckCards} from '_integration/helpers';
import clc from 'cli-color';
import {EGameState} from 'shared/enum/common';
import {formatCards} from 'server/helpers/cardHelpers';
import type {IServerEvent} from 'shared/interfaces/socket';
import {EGameLogType} from 'shared/enum/gameLogType';
import type {IGameLogEntry} from 'shared/interfaces/gameLog';
import type {IFormatCardDraw, IFormatCardEffect} from 'shared/interfaces/common';

// Сколько последних применений карт держим для клиента: он показывает только
// то, что случилось с прошлого обновления, но переподключившемуся полезно
// увидеть хвост, а не пустоту.
const cardEffectsKept = 8;
// То же самое для взятий карт из колоды: хвост короче — за столом на восьмерых
// круг успевает пройти быстро, а показывать чужие давние взятия незачем.
const cardDrawsKept = 6;

// Контексты хода, которые бывают только внутри события паники: пока стол ждёт
// ответа по такому контексту, паника считается идущей и её карта лежит на столе.
const panicTurnContexts: ETurnContextType[] = [
  ETurnContextType.chainReaction,
  ETurnContextType.blindDateCardSelect,
  ETurnContextType.forgetfullnessSelect,
  ETurnContextType.oneTwoPersonSelect,
  ETurnContextType.onlyBetweenUsPersonSelect,
  ETurnContextType.friendshipSeduction,
];

export class Game {
  id: string = '';
  state: EGameState = EGameState.lobby;
  players: { [key: string]: Player } = {};
  playersList: string[] = [];
  deck: ICardAny[] = [];
  discardedDeck: ICardAny[] = [];
  turnPlayerId: string | null = null;
  isClockwise : boolean = true;
  hostPlayerId: string = '';
  gameLog: IGameLogEntry[] = [];
  turnContext: ITurnContext | null = null;
  cardEffects: IFormatCardEffect[] = [];
  cardEffectSeq: number = 0;
  cardDraws: IFormatCardDraw[] = [];
  cardDrawSeq: number = 0;
  // Сработавшая паника: карта лежит на столе всё время своего события, клиент
  // показывает её крупно в центре и не даёт тянуть новую карту, пока она там.
  panicCard: ICardPanic | null = null;
  panicPlayerId: string | null = null;
  // Мгновенные паники (три-четыре, старые верёвки) заканчиваются раньше, чем
  // игра успевает разослать хоть одно обновление, поэтому карту снимаем не
  // раньше, чем она уехала клиентам хотя бы раз.
  isPanicCardSent: boolean = false;
  gameInProcess:boolean = true;
  // Every game runs on its own seeded RNG so the whole game is reproducible from
  // this one number (logged as the first game-log line). A bug report's log is
  // enough to replay the exact deal/draws. Override before start() via reseed().
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

  killPlayer = (player: Player) => {
    player.currentAction = null;
	if (player.isThing) {
		this.end('Нечто проиграло');
		return;
	}

    const discardCardIds = player.hand.map(cardToDiscard => cardToDiscard.uniqueId);
    each(discardCardIds, cardUniqueId => {
        if (cardUniqueId) player.discardCard(cardUniqueId)
    });
    //Если он до этого торговал в offense trade и в стейте застряла его карта - дискардим карту
    if (this.turnContext && this.turnContext.type === ETurnContextType.trade && this.turnContext.offensePlayer === player) {
      const undiscardedCard = this.turnContext.offenseCard;
      if (undiscardedCard) {
        this.discardedDeckPush(undiscardedCard);
      }
    }

    player.changeTurnState(ETurnState.dead)
    this.playersList = this.playersList.filter(pId => pId !== player.id);
    const alivePlayers = filter(clone(this.playersList), pId => !!this.players[pId]?.isAlive());

    const cleanPlayers = filter(alivePlayers, pId => !this.players[pId]?.isInfected);
    if (cleanPlayers.length === 0) {
      return this.end('Нечто победило');
    }

    if (alivePlayers.length === 1) {
      return this.end('Нечто проиграло');
    }
  }

  connectPlayer({ player }: {player: Player}) {
    this.players[player.id] = player;
    this.playersList.push(player.id);
    this.updateGame();
    // Состав комнаты поменялся — в лаунчере обновится счётчик игроков.
    gameServer.updateLobby();
  }

  kickPlayer = ({ player, notify =  `Тебя исключили из игры`}: {player: Player, notify:string | null}) => {
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
    this.syncPanicCard();
    const players = this.players;
    each(players, (player: Player) => {
      player.notify(formatUpdateGameEvent({game: this, viewer: player}))
    })
  };

  // Событие паники ещё идёт: либо стол ждёт ответа по «паническому» контексту
  // хода, либо вытянувший панику игрок всё ещё разбирается с её последствиями.
  isPanicInProgress = () => {
    const contextType = this.turnContext ? this.turnContext.type : null;
    if (contextType && panicTurnContexts.includes(contextType)) return true;
    const panicPlayer = this.panicPlayerId ? this.players[this.panicPlayerId] : null;
    return !!panicPlayer && panicPlayer.turnState === ETurnState.inCardActionProgress;
  };

  // Карта паники уходит со стола, как только её событие отыграно — но не раньше,
  // чем клиенты увидели её хотя бы в одном обновлении. Дальше её судьбу решает
  // уже клиент: он держит карту ещё какое-то время, чтобы её успели прочитать.
  syncPanicCard = () => {
    if (!this.panicCard) return;
    if (!this.isPanicCardSent) {
      this.isPanicCardSent = true;
      return;
    }
    if (this.isPanicInProgress()) return;
    this.panicCard = null;
    this.panicPlayerId = null;
  };

  addLog(log: string, type: EGameLogType = EGameLogType.info, force = false) {
    if (this.gameInProcess || force) {
      debugLog(clc.yellowBright(log))
      this.gameLog.push({text: log, type})
    }
  }

  // Применение карты, после которого на столе не остаётся стрелки: подсмотр
  // «Подозрением», отказ от обмена и прочие разовые действия. Клиент рисует их
  // поверх бейджа игрока, поэтому хвост держим коротким — старое ему не нужно.
  addCardEffect({cardId, player, target}: {cardId: string, player: Player, target?: Player | null}) {
    if (!this.gameInProcess) return;
    this.cardEffectSeq += 1;
    this.cardEffects.push({
      seq: this.cardEffectSeq,
      cardId,
      playerId: player.id,
      targetPlayerId: target ? target.id : null,
    });
    if (this.cardEffects.length > cardEffectsKept) this.cardEffects = this.cardEffects.slice(-cardEffectsKept);
  }

  // Карты ушли из колоды игроку на руку. Клиент по этому событию пускает карту
  // от колоды: взявшему — лицом к нему в руку, остальным — рубашкой в его
  // кружок. Обмены и цепную реакцию сюда не пишем: те карты идут не из колоды и
  // летают по своим правилам (см. CardFlight).
  addCardDraw({player, count = 1}: {player: Player, count?: number}) {
    if (!this.gameInProcess) return;
    this.cardDrawSeq += 1;
    this.cardDraws.push({seq: this.cardDrawSeq, playerId: player.id, count});
    if (this.cardDraws.length > cardDrawsKept) this.cardDraws = this.cardDraws.slice(-cardDrawsKept);
  }

  end = (lastMessage: string) => {
    const thingPlayer = find(this.players, {isThing:true});

    const conditionText = lastMessage === 'Нечто проиграло' ? 'не справился' : 'справился';

    if (thingPlayer) {
      this.notifyAllPlayers(formatPlayerNotification({
        player: thingPlayer,
        notification: {
          type: ENotificationAction.gameEnd,
          menu: [{
            action: 'exit',
            text: 'Выход',
          }, {
            action: 'hide',
            text: 'Скрыть',
          }],
          text: `Игра закончена! ${thingPlayer.nickname} ${conditionText} со своим коварным заданием...`,
        },
      }));
    }


    this.addLog(lastMessage ? lastMessage : 'Игра закончена.', EGameLogType.system, true)

    each(this.playersList, (pId) => {
      const pl = this.players[pId];
      if (pl) pl.changeTurnState(ETurnState.idle);
    });
    // Последний кадр стола. Он обязан уйти ДО gameInProcess = false: дальше
    // updateGame молча выходит, и всё, что случилось этим же ходом, до клиентов
    // уже не доедет. Именно из-за этого сожжение Нечто огнемётом не
    // проигрывалось: событие сожжения записано, а обновления с ним не было.
    this.updateGame();
	this.gameInProcess = false;
    gameServer.destroyGame(this.id)
  };

  start = () => {
    const players = this.players;
    debugLog('============================================================');
    // First line of the log is the seed — a bug report's log alone is enough to
    // reproduce the exact deal and draws.
    this.addLog(`Сид игры: ${this.seed}`, EGameLogType.system);
    this.addLog('Игра началась', EGameLogType.system);
    this.state = EGameState.sarted;
    gameStarter(this);
    const firstPlayerId = this.playersList[0];
    if (firstPlayerId) this.changeTurn(firstPlayerId);
    checkAllDeckCards(this, !gameServer.isMock);
    this.notifyAllPlayers(formatStartGameEvent({players}))
    this.updateGame();
    // Комната перешла в «идёт игра» — список в лаунчере должен это показать.
    gameServer.updateLobby();
  };

  shuffleDiscarded = () => {
    this.deck = shuffle(this.discardedDeck, this.rng);
    this.discardedDeck = [];
  };

  makePanic = (player: Player, panicCard: ICardPanic) => {
    this.discardedDeckPush(panicCard);
    this.panicCard = panicCard;
    this.panicPlayerId = player.id;
    this.isPanicCardSent = false;
    panicAction({player, game: this, panicCard});
    if (player.quarantine > 0) {
      player.quarantine = player.quarantine - 1;
    }
    this.updateGame();
  };
  resetGameState = () => {
    this.turnContext = null;
    each(this.players, p => {
      p.currentAction = null;
      if (p.isAlive()) {
        p.changeTurnState(ETurnState.idle);
      }
    })
  };
  discardedDeckPush(card: ICardAny | undefined | null) {
    //debugLog('DISCARDED CARD', card)
    if (!card) {
      throw new Error('Попытка задискардить undefined')
    }
    this.discardedDeck.push(card)
  }



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



  infectPlayer = (playerId: string) => {
    const notificationPlayer = this.players[playerId];
    if (!notificationPlayer) {
      console.error('Неудалось заразить игрока, т.к не было найдено его ID', playerId);
      return;
    }
    notificationPlayer.isInfected = true;

    const cleanPlayerId = find(this.playersList, (pId) => {
      const pl = this.players[pId];
      return !!pl && pl.state === EPlayerState.dummy && !pl.isThing && !pl.isInfected
    });
    if (!cleanPlayerId) {
      this.notifyAllPlayers(formatPlayerNotification({
        player: notificationPlayer,
        notification: {
          type: ENotificationAction.okayCard,
          cards: formatCards([thingCard]),
          text: 'Нечто выйграло'
        },
      }))
      this.end('Нечто победило');
    }
  };

  getFirstCard(): ICardEvent | ICardPanic {
    if (this.deck.length === 0) {
      this.addLog('Колода закончилась, мешаем карты', EGameLogType.system);
      this.shuffleDiscarded();
      return this.getFirstCard();
    }
	let grabbedCard = this.deck.slice(0, 1)[0];
    if (!grabbedCard) {
      return this.getFirstCard();
    }
	this.deck.splice(0, 1);
    return grabbedCard;
  }

  pickFirstEventCard(): ICardEvent {
    const firstCard = this.getFirstCard();
    debugLog('Игрок достает карту событий...')
    if (firstCard.type === ECardType.panic) {
      debugLog('Попалась паника. Игрок берет следующую карту...');
      this.discardedDeckPush(firstCard);
      return this.pickFirstEventCard();
    }
    return firstCard;
  }

  // Добор карты по эффекту сыгранной карты ("возьмите одну карту события").
  // Логируем явно: иначе в логе виден только отказ от обмена, а лишняя карта на
  // руке выглядит как баг.
  grabEventCardFromDeck({player}: {player: Player}) {
    const eventCard = this.pickFirstEventCard();
    debugLog(`Игрок ${player.nickname} взял карту ${eventCard.id}`)
    this.addLog(`Игрок ${player.nickname} берет карту из колоды`, EGameLogType.deck);
    this.addCardDraw({player});
    player.getCard(eventCard);
  }


  endTurn(playerId: string) {
    if (!this.gameInProcess) return
    this.turnContext = null;
    const endTurnPlayer = this.players[playerId];
    if (!endTurnPlayer) return;
    endTurnPlayer.changeTurnState(ETurnState.idle);
    const nextPlayer = endTurnPlayer.getNextAlivePlayer();
    debugLog(`Игрок ${endTurnPlayer.nickname} заканчивает ход`, map(endTurnPlayer.hand, card=> card.id))
    debugLog(`След. игрок ${nextPlayer.nickname}`)
    if (endTurnPlayer.hand.length > 4) {
      throw new Error(`У игрока ${endTurnPlayer.nickname} на руке ${endTurnPlayer.hand.length} карт`)
    }
    this.changeTurn(nextPlayer.id);
    checkAllDeckCards(this, !gameServer.isMock);
  }

  changeTurn(playerId: string): void {
    if (!this.gameInProcess) return;
    const player = this.players[playerId];
    if (!player) {
      debugLog('CHANGE TURN: игрок не найден', playerId)
      return;
    }
    debugLog('CHANGE TURN ', player.nickname)
    player.currentAction = null;
    this.resetGameState()
    this.turnPlayerId = playerId;
    debugLog(`change turn player id ${playerId}`)

    if (!player.isAlive()) {
      //Дверь и мертвец не может ходить
      const nextPlayer = player.getNextAlivePlayer();
      return this.changeTurn(nextPlayer.id)
    }
    this.addLog(`Ходит игрок ${player.nickname}!`, EGameLogType.turn);
    player.changeTurnState(ETurnState.inCardPick);
    // In mock/test mode there is no interactive "draw a card" step: the player
    // immediately draws and enters the action phase (the pre-cardPick contract
    // the unit scenarios are written against).
    if (gameServer.isMock) {
      this.cardPick({player});
    }
    checkAllDeckCards(this, !gameServer.isMock);
    this.updateGame();
  }


  cardPick = ({player}: {player:Player}) => {
    //this.resetGameState()
    //Удаляем карту из колоды сверху и даем её игроку
    debugLog('PLAYERS CURRENT ACTION', player.currentAction)
    this.addLog(`Игрок ${player.nickname} берет карту из колоды и ходит...`, EGameLogType.deck);
	let grabbedCard = this.getFirstCard();
    //Если паника, то прекращаем граббинг и создаем панику
    if (grabbedCard.type === ECardType.panic) {
      return this.makePanic(player, grabbedCard);
    }
    player.currentAction = null;
    // Добавляем поднятую карту игроку на руку
    this.addCardDraw({player});
    player.getCard(grabbedCard);
    // Карантин тикает ДО перехода в inCardAction: подпись действия ("только
    // топор или сброс") считается по тому же счетчику, что и доступные действия
    // карт, иначе на последнем ходу карантина они разойдутся.
    if (player.quarantine > 0) {
      if (player.quarantineFresh) {
        // Quarantine was applied in this same turn-cycle: skip the first tick.
        player.quarantineFresh = false;
      } else {
        player.quarantine = player.quarantine - 1;
        if (player.quarantine === 0 ) {
          this.addLog(`Игрок ${player.nickname} вышел из карантина`, EGameLogType.quarantine);
        }
      }
    }
    player.changeTurnState(ETurnState.inCardAction);
    checkAllDeckCards(this, !gameServer.isMock);
  }

  cardAction({
    player,
    actionType,
    cardUniqueId,
    cardUniqueIds,
    selectedPlayerId,
    action,
  }: {
    player:Player,
    actionType: EPlayerActionType,
    cardUniqueId?: string,
    cardUniqueIds?: string[],
    selectedPlayerId?: string,
    action? : string;
  }) {
    if (!this.gameInProcess) return;
    if (cardUniqueId) {
      const card = find(player.hand, {uniqueId: cardUniqueId})
      debugLog(`Player ${player.nickname} igraet ${actionType} kartoi ${cardUniqueId} - ${card && card.id}`);
    }
    if (selectedPlayerId) {
      const selectedPlayer = this.players[selectedPlayerId]
      debugLog(`Player ${player.nickname} выбирает игрока ${selectedPlayer?.nickname}`);
    }
    if (action) {
      debugLog(`Player ${player.nickname} выбирает ${action}`);
    }
    switch (actionType) {
      case EPlayerActionType.actionCancel:
        debugLog(`Игрок ${player.nickname} пытается отменить действие`)
        player.changeTurnState(ETurnState.inCardAction);
        this.turnContext = null;
        this.updateGame();
        return;
      case EPlayerActionType.cardPick:
        if (!player.currentAction || player.currentAction.type !== ENotificationAction.cardPick) {
          console.error('ПОПЫТКА ВЗЯТЬ КАРТУ ВНЕ КОНТЕКСТА cardPick у игрока ' + player.nickname)
          return;
        }
        if (player.currentAction.type === ENotificationAction.cardPick) {
          this.cardPick({player});
          this.updateGame();
        }
        return;
      case EPlayerActionType.cardDiscard:
        if (!cardUniqueId) return;
        discardCardAction({game: this, player, cardUniqueId});
        this.updateGame();
        return;
      case EPlayerActionType.cardTrade:
        if (!cardUniqueId) return;
        if (this.turnContext && this.turnContext.type === ETurnContextType.chainReaction) {
          chainReactionTrade({game: this, player, cardUniqueId});
        } else {
          tradeCard({game: this, player, cardUniqueId});
        }
        this.updateGame();
        return;
      case EPlayerActionType.cardAct:
        if (!cardUniqueId) return;
        actCard({game: this, player, cardUniqueId});
        this.updateGame();
        return;
      case EPlayerActionType.cardsSelect:
        if (!cardUniqueIds || !cardUniqueIds.length) return;
        selectCards({game: this, player, cardUniqueIds});
        this.updateGame();
        return;
      case EPlayerActionType.playerSelect:
        if (!selectedPlayerId) return;
        selectPlayer({game: this, player, selectedPlayerId});
        this.updateGame();
        return;
      case EPlayerActionType.viewConfirm:
        viewConfirm({game: this, player});
        this.updateGame();
        return;
      case EPlayerActionType.actionDecision:
        if (action !== undefined) {
          playerActionDecision({game: this, player, action});
          this.updateGame();
        }
        return;
    }
  };

  swapPlayers = (AId: string, BId: string) => {
    const AIndex = this.playersList.indexOf(AId);
    const BIndex = this.playersList.indexOf(BId);
    if (AIndex === -1 || BIndex === -1) return;
    this.playersList[AIndex] = BId;
    this.playersList[BIndex] = AId;
  };

  destroy() {
    gameServer.destroyGame(this.id);
  }

  playerLeave({player}: {player:Player}) {
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
