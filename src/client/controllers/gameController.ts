import {action, computed, observable} from "mobx";
import SocketController from 'client/controllers/socketController';
import Player from 'client/models/Player';
import type INotificationAction from 'shared/interfaces/notification';
import RootController from 'client/controllers/rootController';
import {ECardType} from 'shared/enum/cards';
import {EAppState, EGameState} from 'shared/enum/common';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import {EPlayerActionType} from 'shared/enum/playerActions';
import type {IFormatCardDraw, IFormatCardEffect, IFormatPanicCard, IFormatTradeContext} from 'shared/interfaces/common';
import fscreen from 'fscreen';
import {difference, each, filter, keys, merge, reduce} from "lodash";
import {EAsyncState} from 'shared/enum/async';
import type {
	IDeckPayload,
	IGameUpdatePayload,
	IHandActionsMap,
	IHandMap,
	IPlayersMap,
} from 'client/controllers/socketTypes';
import {ENotificationAction} from 'shared/enum/notifications';
import type {IGameLogEntry} from 'shared/interfaces/gameLog';

// Сколько карта паники минимум лежит на столе, даже если само её событие
// отыгралось мгновенно: столько нужно, чтобы стол успел прочитать, что вообще
// произошло. Пока карта там, новую из колоды не тянут.
const panicCardHoldMs = 5000;

export default class GameController {
	root: RootController;
	socket: SocketController;

	@observable state: EGameState = EGameState.lobby;
	@observable id : string | null = null;
	@observable players: IPlayersMap = {};
	@observable currentPlayerId : string | null = null;
	@observable playersList: string[] = [];
	@observable gameLog: IGameLogEntry[] = [];
	// Лог свёрнут по умолчанию: он перекрывает стол, а самое важное (текущее
	// действие) дублируется крупным индикатором.
	@observable isGameLogOpen: boolean = false;
	@observable deck: IDeckPayload = {count: 0, topCardType: ECardType.event};
	@observable notifications: INotificationAction[] = [];
	@observable playersToSelect: string[] = [];
	@observable isLayoutSequential: boolean = true;
	@observable isFullScreen: boolean = false;
	@observable tradeContext: IFormatTradeContext[] | null = null;
	// Разовые применения карт (подсмотр, отказ от обмена и т.п.): стол рисует их
	// поверх бейджа игрока. Смотри IFormatCardEffect.
	@observable cardEffects: IFormatCardEffect[] = [];
	// Взятия карт из колоды: стол пускает по ним карту от колоды к игроку.
	// Смотри IFormatCardDraw и CardDraw.
	@observable cardDraws: IFormatCardDraw[] = [];
	// Мои карты, только что взятые из колоды: рука вводит их полётом от колоды, а
	// не обычным появлением. Смотри markDrawnCards и HandComponent.
	@observable drawnCardIds: string[] = [];
	// Номер последнего учтённого взятия. null — обновлений ещё не было.
	lastDrawSeq: number | null = null;
	// Сработавшая паника: лежит крупно в центре стола, пока идёт её событие (это
	// решает сервер) и пока не вышел panicCardMinMs. Смотри syncPanicCard.
	@observable panicCard: IFormatPanicCard | null = null;
	// Паника всё ещё идёт по мнению сервера.
	isPanicOnServer: boolean = false;
	// Минимум показа уже отсчитан.
	isPanicHoldOver: boolean = true;
	panicHoldTimer: ReturnType<typeof setTimeout> | null = null;
	// Нажатие по колоде, сделанное пока на столе лежала паника (см. cardPick).
	isCardPickDeferred: boolean = false;
	// Поле, а не константа: e2e опускает минимум, чтобы не ждать по пять секунд
	// на каждой панике (специальный спек проверяет настоящую выдержку).
	panicCardMinMs: number = panicCardHoldMs;
	@observable currentAction: INotificationAction | null = null;
	@observable hand: IHandMap = {};
	@observable handActions: IHandActionsMap = {};
	@observable cardInPreview: string | null = null;
	@observable cardInNotificationPreview: string | null = null;
	@observable hostPlayerId: string = '';
	@observable isPlayerCanCancel: boolean = false;
	@observable isMenuOpen: boolean = false;
	// Живёт дольше самого уведомления о конце игры: игрок может его скрыть и
	// остаться дочитывать лог, но выход ему всё равно нужен — см. TableMenu.
	@observable isGameOver: boolean = false;

	constructor(root: RootController) {
		this.root = root;
		this.socket = root.socketController;
		// E2E handle: the Playwright per-card specs drive the game through this
		// controller (the same methods the canvas pointer handlers invoke) and
		// read its observable state. Exposing it is harmless in production.
		if (typeof window !== 'undefined') {
			(window as unknown as {__nechto?: GameController}).__nechto = this;
		}
		fscreen.addEventListener('fullscreenchange', () => {
			this.isFullScreen = !!fscreen.fullscreenElement
		});
	}

	@computed get currentPlayer(): Player | null {
		if (!this.currentPlayerId) return null;
		return this.players[this.currentPlayerId] || null;
	}


	kickPlayer = (playerId: string) => {
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

	activatePlayerSelectMode = (notification: INotificationAction) => {
		this.playersToSelect = notification.type === ENotificationAction.playerSelect
			? notification.playersToSelect
			: [];
		this.notifications = this.notifications.slice(1);
	};

	selectNotificationCardPreview = (index: string) => {
		if (this.cardInNotificationPreview === index) {
			this.cardInNotificationPreview = null;
		} else {
			this.cardInNotificationPreview = index;
		}
	}

	// NOTE: reassign the observable array rather than mutating it (push/splice).
	// Under react-pixi-fiber, the Notifier observer only reliably re-renders on a
	// prop reassignment, not on in-place array mutation — see notifier.tsx.
	addNotification = (notification: INotificationAction) => {
		if (notification.type === ENotificationAction.gameEnd) {
			this.isGameOver = true;
			// Обновлений стола после конца игры не будет, поэтому снять карту паники
			// сервер уже не попросит — снимаем сами, как только выйдет её выдержка.
			this.isPanicOnServer = false;
			this.hidePanicCardIfDone();
		}
		this.notifications = [...this.notifications, notification];
	};

	toggleMenu = () => {
		this.isMenuOpen = !this.isMenuOpen;
	};

	closeMenu = () => {
		this.isMenuOpen = false;
	};

	hidENotificationAction = () => {
		this.notifications = this.notifications.slice(1);
	};

	selectCard = (notification: INotificationAction, cardUniqueId: string) => {
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.cardSelect, actionContext: notification, cardUniqueId});
		this.hidENotificationAction();
	};

	selectPlayer = (playerId: string ) => {
		this.playersToSelect = [];
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.playerSelect, selectedPlayerId: playerId});
	};

	cardPick = () => {
		// Пока на столе лежит карта паники, колода закрыта: сперва все читают, что
		// случилось (колода в это время и не подсвечена — см. Deck). Нажатие при
		// этом не теряем, а исполняем, как только карта уйдёт: иначе клик уходит в
		// пустоту и игрок (или бот) жмёт по мёртвой колоде.
		if (this.panicCard) {
			this.isCardPickDeferred = true;
			return;
		}
		this.isCardPickDeferred = false;
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.cardPick});
	}

	// Карта паники живёт на столе, пока идёт само событие — это решает сервер, —
	// но не меньше panicCardMinMs: мгновенные паники (вроде «старых верёвок»)
	// иначе мелькнули бы, и никто не понял бы, что произошло.
	@action syncPanicCard = (panicCard: IFormatPanicCard | null) => {
		const isNewPanic = !!panicCard && (!this.panicCard || panicCard.uniqueId !== this.panicCard.uniqueId);
		this.isPanicOnServer = !!panicCard;
		if (panicCard && isNewPanic) {
			this.panicCard = panicCard;
			this.isPanicHoldOver = false;
			if (this.panicHoldTimer) clearTimeout(this.panicHoldTimer);
			this.panicHoldTimer = setTimeout(this.releasePanicCard, this.panicCardMinMs);
			return;
		}
		this.hidePanicCardIfDone();
	};

	@action releasePanicCard = () => {
		this.panicHoldTimer = null;
		this.isPanicHoldOver = true;
		this.hidePanicCardIfDone();
	};

	@action hidePanicCardIfDone = () => {
		if (this.isPanicOnServer || !this.isPanicHoldOver) return;
		this.panicCard = null;
		// Нажатие по закрытой колоде исполняем теперь — если брать карту всё ещё
		// нам (за время паники ход мог и уйти).
		if (!this.isCardPickDeferred) return;
		this.isCardPickDeferred = false;
		if (this.currentAction && this.currentAction.type === ENotificationAction.cardPick) this.cardPick();
	};

	actionDecision = (action: string ) => {
		this.hidENotificationAction();
		switch (action) {
			case 'restart':
				this.isGameOver = false;
				this.isMenuOpen = false;
				this.root.state = EAppState.game;
				this.state = EGameState.lobby;
				return;
			case 'exit':
				// Через backToLauncher, а не просто сменой экрана: сервер должен узнать,
				// что игрок ушёл, иначе его сокет остаётся привязанным к мёртвой игре и
				// список комнат в лаунчере больше никогда не обновится.
				this.backToLauncher();
				return;
			case 'hide':
				// Уведомление скрыто, но игра всё равно закончена — выйти теперь можно
				// только через меню стола (isGameOver), поэтому флаг и не сбрасывается.
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

	// Какие из моих карт прямо сейчас пришли из колоды: рука вводит их не как
	// обычные новые карты, а полётом от колоды (см. HandComponent). Считаем это
	// здесь, потому что только здесь ещё видна рука ДО обновления: дальше она уже
	// перезаписана. Сверяем два источника — событие взятия с сервера и саму руку;
	// если пришло не столько карт, сколько взято (скажем, обмен случился в том же
	// обновлении), какая из них какая — непонятно, и полёт не назначаем никому.
	markDrawnCards = (cardDraws: IFormatCardDraw[], viewerId: string, newHand: IHandMap) => {
		const latestSeq = reduce(cardDraws, (acc: number, {seq}) => Math.max(acc, seq), 0);
		const seenSeq = this.lastDrawSeq;
		const fresh = seenSeq === null ? [] : filter(cardDraws, ({seq}) => seq > seenSeq);
		this.lastDrawSeq = latestSeq;
		// Первое обновление — это вход в игру: вся рука «новая», но прилетать ей
		// неоткуда. Так же и переподключившийся не догоняет чужие взятия разом.
		if (seenSeq === null) {
			this.drawnCardIds = [];
			return;
		}
		const drawnCount = reduce(fresh, (acc: number, {playerId, count}) => acc + (playerId === viewerId ? count : 0), 0);
		const arrived = difference(keys(newHand), keys(this.hand));
		this.drawnCardIds = drawnCount > 0 && arrived.length === drawnCount ? arrived : [];
	};

	updateHand = (newHand: IHandMap) => {
		each(this.hand, card => {
			if (card.uniqueId && !newHand[card.uniqueId]) delete this.hand[card.uniqueId]
		});
		merge(this.hand, newHand)
	};

	updatePlayers = (newPlayers: IPlayersMap) => {
		merge(this.players, newPlayers);
		each(this.players, (player) => {
			if (player && !newPlayers[player.id]) {
				delete this.players[player.id];
			}
		})
	};

	updateHandActions = (handActions: IHandActionsMap) => {
		this.handActions = handActions
	};

	// Одним действием: без него mobx отдаёт реакциям каждое присваивание по
	// отдельности, и компонент успевает отрисоваться с новым контекстом хода, но
	// ещё старой рукой и логом — а анимация обмена сверяет ровно их между собой.
	@action updateGame = ({tradeContext, cardEffects, cardDraws, panicCard, players, playersList, deck, gameLog, currentAction, state, currentPlayer, hand, handActions, hostPlayerId, isPlayerCanCancel}: IGameUpdatePayload) => {
		this.updatePlayers(players);
		this.markDrawnCards(cardDraws, currentPlayer.id, hand);
		this.updateHand(hand);
		this.updateHandActions(handActions);
		this.hostPlayerId = hostPlayerId;
		this.playersList = playersList;
		this.deck = deck;
		this.isPlayerCanCancel = isPlayerCanCancel;
		this.currentPlayerId = currentPlayer.id;
		this.tradeContext = tradeContext;
		this.cardEffects = cardEffects;
		this.cardDraws = cardDraws;
		this.syncPanicCard(panicCard);
		this.currentAction = currentAction;
		this.state = state;
		this.gameLog = gameLog;
	};

	toggleGameLog = () => {
		this.isGameLogOpen = !this.isGameLogOpen;
	};

	backToLauncher = () => {
		this.socket.sendToServer(EClientEventType.leaveGame, {})
		// Чистим экранное состояние стола: иначе следующая игра открывается с чужими
		// уведомлениями и старым индикатором действия.
		this.isMenuOpen = false;
		this.isGameOver = false;
		this.notifications = [];
		this.currentAction = null;
		this.playersToSelect = [];
		if (this.panicHoldTimer) clearTimeout(this.panicHoldTimer);
		this.panicHoldTimer = null;
		this.isPanicOnServer = false;
		this.isPanicHoldOver = true;
		this.panicCard = null;
		this.isCardPickDeferred = false;
		// Следующая игра начинается со своего счёта взятий, и рука в ней раздаётся,
		// а не прилетает из колоды.
		this.drawnCardIds = [];
		this.lastDrawSeq = null;
		this.state = EGameState.lobby;
		this.root.launcherController.state = EAsyncState.idle;
		this.root.state = EAppState.launcher;
	}

	actionCancel = () => {
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.actionCancel});
	}

	changePlayerMark = (playerId: string) => {
		this.socket.sendToServer(EClientEventType.markPlayer, {playerId});
	}
}
