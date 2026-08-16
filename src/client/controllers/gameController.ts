import {action, computed, observable} from "mobx";
import SocketController from 'client/controllers/socketController';
import Player from 'client/models/Player';
import type INotificationAction from 'shared/interfaces/notification';
import RootController from 'client/controllers/rootController';
import {EAppState, EGameState} from 'shared/enum/common';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import {EPlayerActionType} from 'shared/enum/playerActions';
import fscreen from 'fscreen';
import {each, filter, findIndex, keys, merge} from "lodash";
import {EAsyncState} from 'shared/enum/async';
import type {IGameUpdatePayload, IPlayersMap, IRoundPayload} from 'client/controllers/socketTypes';
import {ENotificationAction} from 'shared/enum/notifications';
import {playGameEnd, playMissionFail, playMissionSuccess, playPaper, startMusic, stopMusic} from 'client/helpers/sounds';
import type {IGameLogEntry} from 'shared/interfaces/gameLog';

// Вид стола — настройка игрока, а не игры: её спрашивают один раз и помнят.
// Локальное хранилище, а не localforage (им хранится ник): читать надо
// синхронно, в первом же кадре стола, иначе он успевает нарисоваться в одном
// виде и перескочить в другой.
const firstPersonTableKey = 'isFirstPersonTable';

// Сколько летит один жетон, на сколько отстаёт каждый следующий и сколько живёт
// весь полёт. Время здесь, а не в самом столе: полёт заводит и гасит контроллер,
// а рисует его Room (см. RejectFlight) — сроки должны быть одни на двоих.
export const rejectFlightMs = 620;
export const rejectFlightStaggerMs = 90;
export const rejectFlightMaxStagger = 4;
export const rejectFlightTotalMs = rejectFlightMs + rejectFlightStaggerMs * rejectFlightMaxStagger;

/** Отклонённый состав в полёте: чьи пальцы летят и в какое деление счётчика. */
export interface IRejectFlight {
	voterIds: string[];
	slot: number;
	// Меняется на каждый новый полёт: по нему стол пересобирает летящие жетоны.
	key: number;
}

const loadFirstPersonTable = (): boolean => {
	try {
		return window.localStorage.getItem(firstPersonTableKey) === 'true';
	} catch {
		// Приватный режим и запрет на хранилище: играть это не мешает, стол
		// просто останется в виде по умолчанию.
		return false;
	}
};

const saveFirstPersonTable = (value: boolean): void => {
	try {
		window.localStorage.setItem(firstPersonTableKey, String(value));
	} catch {
		// см. loadFirstPersonTable
	}
};

export default class GameController {
	root: RootController;
	socket: SocketController;

	@observable state: EGameState = EGameState.lobby;
	@observable id: string | null = null;
	@observable players: IPlayersMap = {};
	@observable currentPlayerId: string | null = null;
	@observable playersList: string[] = [];
	// Чей сейчас ход — лидер раунда. Стол наводит на него прицел.
	@observable turnPlayerId: string | null = null;
	@observable isClockwise: boolean = true;
	@observable gameLog: IGameLogEntry[] = [];
	@observable notifications: INotificationAction[] = [];
	@observable playersToSelect: string[] = [];
	// Стол развёрнут так, что ты сидишь внизу. По умолчанию выключено: стол
	// абсолютный, у всех одинаковый (см. roomPlayerOrder).
	@observable isFirstPersonTable: boolean = loadFirstPersonTable();
	@observable isFullScreen: boolean = false;
	// Состояние партии: фаза, счёт миссий, лидер, команда, счётчик отклонений.
	// До первого обновления его нет — стол в это время ещё в лобби.
	@observable round: IRoundPayload | null = null;
	@observable currentAction: INotificationAction | null = null;
	// Секунды до автоответа на текущий вопрос: их показывает кнопка по умолчанию
	// (см. startDecisionCountdown). null — отсчитывать нечего.
	@observable decisionSecondsLeft: number | null = null;
	decisionTimer: ReturnType<typeof setInterval> | null = null;
	@observable hostPlayerId: string = '';
	@observable isMenuOpen: boolean = false;
	// Живёт дольше самого уведомления о конце игры: игрок может его скрыть и
	// остаться дочитывать лог, но выход ему всё равно нужен — см. TableMenu.
	@observable isGameOver: boolean = false;
	// Летящие в счётчик отклонения: кто голосовал против и в какое деление они
	// летят. null — сейчас ничего не летит (см. syncRejectFlight).
	@observable rejectFlight: IRejectFlight | null = null;
	rejectFlightTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(root: RootController) {
		this.root = root;
		this.socket = root.socketController;
		// E2E handle: the Playwright specs drive the game through this controller
		// (the same methods the canvas pointer handlers invoke) and read back its
		// observable state. Exposing it is harmless in production.
		if (typeof window !== 'undefined') {
			(window as unknown as {__resistance?: GameController}).__resistance = this;
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

	activatePlayerSelectMode = (notification: INotificationAction) => {
		this.playersToSelect = notification.type === ENotificationAction.playerSelect
			? notification.playersToSelect
			: [];
		this.notifications = this.notifications.slice(1);
	};

	// NOTE: reassign the observable array rather than mutating it (push/splice).
	// Under react-pixi-fiber, the Notifier observer only reliably re-renders on a
	// prop reassignment, not on in-place array mutation — see notifier.tsx.
	addNotification = (notification: INotificationAction) => {
		// Отсчёт до автоответа заводим по самому вопросу, а не по currentAction:
		// обновления стола приносят тот же вопрос заново, и отсчёт стартовал бы с
		// начала на каждом чужом действии.
		if (notification.type === ENotificationAction.actionDecision) this.startDecisionCountdown(notification.seconds);
		if (notification.type === ENotificationAction.gameEnd) {
			this.isGameOver = true;
			playGameEnd(notification.isSpiesWin);
			// Развязка отменяет все незакрытые вопросы. Своим обновлением их уже не
			// снять: партии конец, обновлений больше не будет (см. Game.updateGame), а
			// очередь показывает только первое уведомление и разбирается нажатием —
			// оставшийся вопрос закрыл бы собой и развязку, и кнопку меню.
			this.dropPendingQuestions();
			this.stopDecisionCountdown();
		}
		this.notifications = [...this.notifications, notification];
	};

	// Вопросы, на которые сервер ответа больше не ждёт. Живой игрок разбирает
	// очередь нажатием, но кнопку за него может нажать и сервер (см.
	// askDecision) — тогда вопрос повисает в очереди навсегда.
	dropPendingQuestions = () => {
		this.notifications = filter(this.notifications, (n) => n.type !== ENotificationAction.actionDecision);
	};

	// Сколько секунд осталось до того, как сервер нажмёт кнопку по умолчанию сам
	// (см. server/helpers/askDecision). null — вопроса с отсчётом сейчас нет.
	@action startDecisionCountdown = (seconds: number | undefined) => {
		this.stopDecisionCountdown();
		if (!seconds) return;
		this.decisionSecondsLeft = seconds;
		this.decisionTimer = setInterval(() => this.tickDecisionCountdown(), 1000);
	};

	@action tickDecisionCountdown = () => {
		if (this.decisionSecondsLeft === null) return;
		// На нуле замираем: закрыть окно — дело сервера, он же и отыграет ответ.
		this.decisionSecondsLeft = Math.max(0, this.decisionSecondsLeft - 1);
	};

	@action stopDecisionCountdown = () => {
		if (this.decisionTimer) clearInterval(this.decisionTimer);
		this.decisionTimer = null;
		this.decisionSecondsLeft = null;
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

	selectPlayer = (playerId: string) => {
		this.playersToSelect = [];
		this.socket.sendToServer(EClientEventType.playerAction, {actionType: EPlayerActionType.playerSelect, selectedPlayerId: playerId});
	};

	actionDecision = (action: string) => {
		this.hidENotificationAction();
		this.stopDecisionCountdown();
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

	toggleFirstPersonTable = () => {
		this.isFirstPersonTable = !this.isFirstPersonTable;
		saveFirstPersonTable(this.isFirstPersonTable);
	}

	toggleFullScreen = () => {
		if (!fscreen.fullscreenEnabled) return;
		if (!this.isFullScreen) {
			fscreen.requestFullscreen(document.getElementById("root"));
		} else {
			fscreen.exitFullscreen();
		}
	};

	updatePlayers = (newPlayers: IPlayersMap) => {
		merge(this.players, newPlayers);
		each(this.players, (player) => {
			if (player && !newPlayers[player.id]) {
				delete this.players[player.id];
			}
		})
	};

	// Одним действием: без него mobx отдаёт реакциям каждое присваивание по
	// отдельности, и компонент успевает отрисоваться наполовину обновлённым.
	@action updateGame = ({players, playersList, turnPlayerId, gameLog, currentAction, state, currentPlayer, hostPlayerId, isClockwise, round}: IGameUpdatePayload) => {
		this.updatePlayers(players);
		this.hostPlayerId = hostPlayerId;
		this.playersList = playersList;
		this.isClockwise = isClockwise;
		this.turnPlayerId = turnPlayerId;
		this.currentPlayerId = currentPlayer.id;
		this.currentAction = currentAction;
		this.syncRoundSounds(round);
		this.syncRejectFlight(round);
		this.round = round;
		// Вопрос закрыт (ответили сами или за нас) — отсчитывать больше нечего, и
		// висеть ему в очереди тоже.
		if (!currentAction || currentAction.type !== ENotificationAction.actionDecision) {
			this.stopDecisionCountdown();
			this.dropPendingQuestions();
		}
		// Партия началась — тема замолкает. Обычно её снимает событие начала игры
		// (см. socketController), но пришедшему в партию заново его уже не пришлют:
		// перезагрузивший вкладку узнаёт о идущей игре только отсюда, первым же
		// обновлением.
		if (state === EGameState.sarted && this.state !== EGameState.sarted) stopMusic();
		this.state = state;
		this.gameLog = gameLog;
	};

	// Две кульминации раунда звучат: вскрытие голосов и вскрытый результат
	// миссии. Считаем их по самому обновлению, а не по событиям: партия
	// восстанавливается из состояния целиком (реконнект), и отдельных «событий
	// вскрытия» у сервера нет.
	syncRoundSounds = (round: IRoundPayload) => {
		const previous = this.round;
		if (!previous) return;
		if (!previous.revealedVotes && round.revealedVotes) playPaper();
		// Миссия сыграна: её исход только что появился в треке. Успех и провал
		// звучат по-разному — стол узнаёт исход ухом, ещё не дочитав подпись.
		const played = findIndex(round.missionResults, (result, index) =>
			result !== null && previous.missionResults[index] === null);
		if (played >= 0) {
			if (round.missionResults[played]) playMissionSuccess();
			else playMissionFail();
		}
	};

	/**
	 * Отклонённый состав: пальцы тех, кто голосовал против, летят со своих мест в
	 * деление счётчика, и оно загорается, когда они долетают.
	 *
	 * Замечаем это по обновлению, а не по событию: счётчик растёт на сервере в
	 * конце паузы вскрытия, и тем же обновлением голоса со стола убираются — то
	 * есть в этот самый миг жетоны с кружков и исчезают. Кто голосовал против,
	 * помним из ПРЕДЫДУЩЕГО состояния: в новом голосов уже нет.
	 */
	syncRejectFlight = (round: IRoundPayload) => {
		const previous = this.round;
		if (!previous || round.rejectCount <= previous.rejectCount) return;
		const votes = previous.revealedVotes ?? {};
		const voterIds = filter(keys(votes), (id) => votes[id] === false);
		if (!voterIds.length) return;
		this.startRejectFlight(voterIds, round.rejectCount - 1);
	};

	@action startRejectFlight = (voterIds: string[], slot: number) => {
		if (this.rejectFlightTimer) clearTimeout(this.rejectFlightTimer);
		// key — чтобы стол пересобрал летящие жетоны, даже если предыдущий полёт
		// ещё не догорел: пружины заводятся один раз, при появлении.
		this.rejectFlight = {voterIds, slot, key: (this.rejectFlight?.key ?? 0) + 1};
		this.rejectFlightTimer = setTimeout(() => this.endRejectFlight(), rejectFlightTotalMs);
	};

	@action endRejectFlight = () => {
		if (this.rejectFlightTimer) clearTimeout(this.rejectFlightTimer);
		this.rejectFlightTimer = null;
		this.rejectFlight = null;
	};

	backToLauncher = () => {
		this.socket.sendToServer(EClientEventType.leaveGame, {})
		// Со стола уходят — значит партии для этого игрока больше нет, и тема
		// возвращается на лобби. Уже играющую (ушли после развязки) startMusic не
		// перебивает.
		startMusic();
		// Чистим экранное состояние стола: иначе следующая игра открывается с чужими
		// уведомлениями и старым индикатором действия.
		this.isMenuOpen = false;
		this.isGameOver = false;
		this.notifications = [];
		this.currentAction = null;
		this.stopDecisionCountdown();
		this.playersToSelect = [];
		this.round = null;
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
