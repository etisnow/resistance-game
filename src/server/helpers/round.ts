import {filter, includes, keys, values} from 'lodash';
import {shuffle} from 'server/helpers/util';
import {formatTimerNotification} from 'server/formatters/formatOutgoingEvents';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {EGamePhase} from 'shared/enum/phase';
import {ENotificationAction} from 'shared/enum/notifications';
import {EGameLogType} from 'shared/enum/gameLogType';
import {askDecision, decisionTimeout} from 'server/helpers/askDecision';
import {scheduleBots} from 'server/helpers/bot';
import {gameServer} from 'server/server/GameServer';
import {failsNeeded, MAX_REJECTS, MISSIONS_COUNT, MISSIONS_TO_WIN, teamSize} from 'shared/constant/resistance';

/**
 * Ход раунда «Сопротивления»: набор команды → голосование → миссия. Здесь живут
 * все переходы между фазами; сама Game отвечает только за стол, рассылку и лог.
 *
 * Ответы игроков приходят сюда из GameServer.playerAction — тем же путём, каким
 * их отдаёт живой клиент, бот и автоответ по таймауту.
 */

// Что игрок нажимает. Строками, а не enum'ом: они уезжают в меню вопроса и
// возвращаются обратно как есть (см. askDecision).
export const ACTION = {
	approve: 'approve',
	reject: 'reject',
	success: 'success',
	fail: 'fail',
	confirmTeam: 'confirmTeam',
	resetTeam: 'resetTeam',
} as const;

// Сколько лидер думает над составом. Больше, чем над голосом: набрать пятерых —
// это и есть то самое обсуждение, ради которого играют (см. docs/PRD.md, FR-4).
const TEAM_DECISION_SECONDS = 180;

// Сколько ждём состава от молчащего лидера, прежде чем набрать за него. Это
// страховка против ушедшего, а не ограничение на обсуждение (FR-11): пока лидер
// жив и тыкает в игроков, отсчёт заводится заново.
const TEAM_PICK_TIMEOUT_MS = TEAM_DECISION_SECONDS * 1000;

// По одному таймеру на игру: новый вопрос лидеру отменяет предыдущий.
const teamTimers = new WeakMap<Game, ReturnType<typeof setTimeout>>();

const clearTeamTimer = (game: Game): void => {
	const timer = teamTimers.get(game);
	if (!timer) return;
	clearTimeout(timer);
	teamTimers.delete(game);
};

// Лидер молчит — добираем состав случайными игроками и отправляем его на
// голосование. Стол сам решит, годится ли такая команда.
const armTeamTimer = (game: Game): void => {
	clearTeamTimer(game);
	const timer = setTimeout(() => {
		teamTimers.delete(game);
		if (!game.gameInProcess) return;
		if (game.round.phase !== EGamePhase.teamBuilding) return;
		try {
			const missing = currentTeamSize(game) - game.round.team.length;
			const candidates = filter(seatedIds(game), (id) => !includes(game.round.team, id));
			game.round.team.push(...shuffle(candidates, game.rng).slice(0, missing));
			game.addLog(`${leaderOf(game).nickname} молчит — команду добрали за него`, EGameLogType.system);
			leaderOf(game).currentAction = null;
			beginVoting(game);
		} catch (e) {
			console.error('[round] team timeout error:', e);
		}
	}, TEAM_PICK_TIMEOUT_MS);
	timer.unref();
	teamTimers.set(game, timer);
};

const seatedIds = (game: Game): string[] => game.seatedPlayers().map((p) => p.id);

const leaderOf = (game: Game): Player => {
	const leader = game.players[game.round.leaderId];
	if (!leader) throw new Error('Лидер раунда не найден за столом');
	return leader;
};

const nicknamesOf = (game: Game, ids: string[]): string =>
	ids.map((id) => game.players[id]?.nickname ?? '?').join(', ');

/** Сколько человек требует текущая миссия. */
export const currentTeamSize = (game: Game): number =>
	teamSize(seatedIds(game).length, game.round.missionIndex);

// ---------------------------------------------------------------- набор команды

export const beginTeamBuilding = (game: Game): void => {
	const round = game.round;
	round.phase = EGamePhase.teamBuilding;
	round.team = [];
	round.votes = {};
	round.missionCards = {};
	// Прицел стола наводится на лидера: он один, и ход сейчас его.
	game.turnPlayerId = round.leaderId;
	game.addLog(
		`Миссия ${round.missionIndex + 1}: ${leaderOf(game).nickname} набирает ${currentTeamSize(game)} чел.`,
		EGameLogType.turn,
	);
	askTeamMember(game);
	game.updateGame();
};

// Лидер выбирает по одному: так стол видит набор вживую, а лидер может
// передумать до самого «Готово» (см. FR-4).
const askTeamMember = (game: Game): void => {
	const round = game.round;
	const leader = leaderOf(game);
	const left = currentTeamSize(game) - round.team.length;
	game.notifyPlayer({
		player: leader,
		notification: {
			type: ENotificationAction.playerSelect,
			text: `Выбери в команду ещё ${left} чел.`,
			playersToSelect: filter(seatedIds(game), (id) => !includes(round.team, id)),
		},
	});
	awaitPlayers(game, [leader], `${leader.nickname} набирает команду`, TEAM_DECISION_SECONDS);
	armTeamTimer(game);
};

// Кого стол сейчас ждёт. Одним сообщением на всю фазу: в «Сопротивлении»
// спрашивают сразу многих, и таймер должен показывать их всех, а не последнего.
const awaitPlayers = (game: Game, players: Player[], text: string, seconds: number): void => {
	game.notifyAllPlayers(formatTimerNotification({
		text,
		seconds,
		playerIds: players.map((p) => p.id),
	}));
};

// Состав набран — спрашиваем лидера, отправлять ли его. Кнопка по умолчанию (а
// сервер жмёт последнюю) — «Готово»: молчащий лидер не должен держать стол.
const askTeamConfirm = (game: Game): void => {
	const leader = leaderOf(game);
	askDecision({
		asker: leader,
		decider: leader,
		text: `Команда: ${nicknamesOf(game, game.round.team)}. Отправляем?`,
		menu: [
			{text: 'Набрать заново', action: ACTION.resetTeam},
			{text: 'Готово', action: ACTION.confirmTeam},
		],
		seconds: TEAM_DECISION_SECONDS,
	});
};

export const onPlayerSelect = (game: Game, player: Player, selectedPlayerId: string): void => {
	const round = game.round;
	if (round.phase !== EGamePhase.teamBuilding) return;
	// Команду набирает лидер, и только он: без этой проверки состав мог бы
	// править любой, отправив событие в сокет.
	if (player.id !== round.leaderId) return;
	if (includes(round.team, selectedPlayerId)) return;
	if (!includes(seatedIds(game), selectedPlayerId)) return;

	round.team.push(selectedPlayerId);
	player.currentAction = null;
	game.addLog(`${player.nickname} берёт в команду ${game.players[selectedPlayerId]?.nickname}`, EGameLogType.info);

	if (round.team.length < currentTeamSize(game)) {
		askTeamMember(game);
	} else {
		askTeamConfirm(game);
	}
	game.updateGame();
};

// Сколько стол смотрит на вскрытое, прежде чем игра идёт дальше. И голоса, и
// итог миссии успевают не только прочитать, но и обсудить — потому по пять
// секунд. Полем, а не константами, — как decisionTimeout: движковые тесты ходят
// синхронно, и пауза, которая нужна живым глазам, им только мешает.
export const revealPause = {votes: 5, mission: 5};

// Продолжение хода после вскрытия — через паузу. Ноль секунд означает «сразу»:
// без setTimeout, иначе тесты пришлось бы делать асинхронными.
const afterReveal = (game: Game, seconds: number, next: () => void): void => {
	if (seconds <= 0) return next();
	const timer = setTimeout(() => {
		// За паузу стол могли и разобрать: партия кончилась, игроки вышли.
		if (!game.gameInProcess) return;
		try {
			next();
			// Ботов после паузы будит некому: очередь ботов заводится от хода живого
			// игрока (см. GameServer.playerAction), а он был пять секунд назад.
			scheduleBots(gameServer, game);
		} catch (e) {
			console.error('[round] reveal pause error:', e);
		}
	}, seconds * 1000);
	// Незакрытая пауза не должна держать процесс живым.
	timer.unref();
};

// ---------------------------------------------------------------- голосование

const beginVoting = (game: Game): void => {
	const round = game.round;
	clearTeamTimer(game);
	round.phase = EGamePhase.voting;
	round.votes = {};
	game.addLog(`Голосуем за команду: ${nicknamesOf(game, round.team)}`, EGameLogType.turn);
	// Голосуют все и одновременно — включая тех, кто идёт на дело сам.
	// «Против» стоит последним нарочно: сервер жмёт за молчащего последнюю
	// кнопку, и отсутствующий игрок не должен молча пропускать команду.
	game.seatedPlayers().forEach((player) => {
		askDecision({
			asker: leaderOf(game),
			decider: player,
			text: `Команда ${nicknamesOf(game, round.team)} идёт на миссию ${round.missionIndex + 1}?`,
			menu: [
				{text: 'За', action: ACTION.approve},
				{text: 'Против', action: ACTION.reject},
			],
		});
	});
	awaitPlayers(game, game.seatedPlayers(), 'Стол голосует', decisionTimeout.seconds);
	game.updateGame();
};

const resolveVotes = (game: Game): void => {
	const round = game.round;
	const total = seatedIds(game).length;
	const approvals = filter(values(round.votes), (isApproved) => isApproved).length;
	// Голоса в «Сопротивлении» открытые — по ним и играют, поэтому вскрываем
	// поимённо: и на стол (revealedVotes), и в лог.
	round.revealedVotes = {...round.votes};
	const voted = (isApproved: boolean) =>
		nicknamesOf(game, filter(keys(round.votes), (id) => round.votes[id] === isApproved)) || '—';
	game.addLog(`За: ${voted(true)}. Против: ${voted(false)}`, EGameLogType.info);

	// Показываем вскрытые голоса и держим паузу, прежде чем идти дальше: раньше
	// последний голос переключал фазу в тот же миг, и как проголосовал последний,
	// прочитать никто не успевал.
	game.updateGame();
	afterReveal(game, revealPause.votes, () => {
		// Пауза кончилась — жетоны со стола убираем все разом: они были ответом на
		// один вопрос, и висеть дальше него им незачем. Разойтись они не могут:
		// следующее обновление уходит из перехода фазы, ниже по этой же функции.
		round.revealedVotes = null;

		// Строгое большинство: ничья — это отклонение (FR-6).
		if (approvals * 2 > total) {
			round.rejectCount = 0;
			beginMission(game);
			return;
		}

		round.rejectCount += 1;
		if (round.rejectCount >= MAX_REJECTS) {
			game.addLog(`Стол не смог собрать команду ${MAX_REJECTS} раз подряд`, EGameLogType.system);
			return endMatch(game, {isSpiesWin: true, message: 'Сопротивление развалилось: шпионы победили'});
		}
		game.addLog(`Команда отклонена (${round.rejectCount} из ${MAX_REJECTS})`, EGameLogType.info);
		passLeader(game);
		beginTeamBuilding(game);
	});
};

// ---------------------------------------------------------------- миссия

const beginMission = (game: Game): void => {
	const round = game.round;
	round.phase = EGamePhase.mission;
	round.missionCards = {};
	game.addLog(`Команда ${nicknamesOf(game, round.team)} ушла на миссию`, EGameLogType.turn);

	round.team.forEach((playerId) => {
		const player = game.players[playerId];
		if (!player) return;
		// Сопротивленец не «не может» сыграть провал — у него этой карты просто
		// нет: в меню один пункт (FR-8). Спрашиваем всё равно, потому что пауза
		// сама по себе выдала бы роль, если бы её не было.
		const menu = player.isSpy
			? [
				{text: 'Провал', action: ACTION.fail},
				{text: 'Успех', action: ACTION.success},
			]
			: [{text: 'Успех', action: ACTION.success}];
		askDecision({
			asker: leaderOf(game),
			decider: player,
			text: `Миссия ${round.missionIndex + 1}: что ты сдаёшь?`,
			menu,
		});
	});
	awaitPlayers(
		game,
		round.team.map((id) => game.players[id]).filter((p): p is Player => !!p),
		'Команда на задании',
		decisionTimeout.seconds,
	);
	game.updateGame();
};

const resolveMission = (game: Game): void => {
	const round = game.round;
	const playersCount = seatedIds(game).length;
	const fails = filter(values(round.missionCards), (isSuccess) => !isSuccess).length;
	const needed = failsNeeded(round.missionIndex, playersCount);
	const isSuccess = fails < needed;

	round.missionResults[round.missionIndex] = isSuccess;
	round.missionFails[round.missionIndex] = fails;
	// Вскрываем числом, а не поимённо: кто именно сдал провал — тайна (FR-9).
	game.addLog(
		isSuccess
			? `Миссия ${round.missionIndex + 1} выполнена (провалов: ${fails})`
			: `Миссия ${round.missionIndex + 1} сорвана (провалов: ${fails})`,
		EGameLogType.system,
	);

	// Итог уходит на стол и держится паузу: миссия — кульминация раунда, и её
	// разбирают вслух. Пока пауза идёт, номер миссии не двигаем — стол по нему и
	// оглашает исход (см. MissionTrack).
	game.updateGame();
	afterReveal(game, revealPause.mission, () => {
		// Счётчик отклонений живёт внутри миссии и обнуляется вместе с ней.
		round.rejectCount = 0;
		round.missionIndex += 1;

		const successes = filter(round.missionResults, (result) => result === true).length;
		const failures = filter(round.missionResults, (result) => result === false).length;
		if (successes >= MISSIONS_TO_WIN) {
			return endMatch(game, {isSpiesWin: false, message: 'Три миссии выполнены: сопротивление победило'});
		}
		if (failures >= MISSIONS_TO_WIN) {
			return endMatch(game, {isSpiesWin: true, message: 'Три миссии сорваны: шпионы победили'});
		}

		passLeader(game);
		beginTeamBuilding(game);
	});
};

// ---------------------------------------------------------------- ответы игроков

export const onDecision = (game: Game, player: Player, action: string): void => {
	const round = game.round;
	switch (round.phase) {
		case EGamePhase.teamBuilding: {
			if (player.id !== round.leaderId) return;
			// Вопрос гасим только вместе с принятым ответом. Если гасить раньше
			// проверок, отвергнутое действие оставит лидера без заданного ему
			// вопроса — а без него сервер не примет и следующий ответ, и стол
			// встанет насмерть.
			if (action === ACTION.resetTeam) {
				player.currentAction = null;
				round.team = [];
				game.addLog(`${player.nickname} набирает команду заново`, EGameLogType.info);
				askTeamMember(game);
				game.updateGame();
				return;
			}
			if (action !== ACTION.confirmTeam) return;
			// Подтвердить можно только полный состав: неполный лидеру и не
			// предлагали, но событие в сокет прилететь может.
			if (round.team.length !== currentTeamSize(game)) return;
			player.currentAction = null;
			beginVoting(game);
			return;
		}
		case EGamePhase.voting: {
			if (!includes(seatedIds(game), player.id)) return;
			if (player.id in round.votes) return;
			if (action !== ACTION.approve && action !== ACTION.reject) return;
			round.votes[player.id] = action === ACTION.approve;
			player.currentAction = null;
			// Голоса вскрываются разом: пока голосуют, наружу не уходит ничего,
			// кроме факта «ответил» (см. FR-5).
			if (keys(round.votes).length === seatedIds(game).length) {
				resolveVotes(game);
			} else {
				game.updateGame();
			}
			return;
		}
		case EGamePhase.mission: {
			if (!includes(round.team, player.id)) return;
			if (player.id in round.missionCards) return;
			if (action !== ACTION.success && action !== ACTION.fail) return;
			// Провал есть только у шпиона — и это проверяется здесь, а не только
			// меню: меню рисует клиент, а событие можно отправить и мимо него.
			if (action === ACTION.fail && !player.isSpy) return;
			round.missionCards[player.id] = action === ACTION.success;
			player.currentAction = null;
			if (keys(round.missionCards).length === round.team.length) {
				resolveMission(game);
			} else {
				game.updateGame();
			}
			return;
		}
		default:
			return;
	}
};

// ---------------------------------------------------------------- служебное

// Карта лидера идёт по кругу — и после отклонения тоже (FR-3).
const passLeader = (game: Game): void => {
	game.round.leaderId = game.getPlayerByPosition({playerId: game.round.leaderId, isNext: true}).id;
};

const endMatch = (game: Game, {isSpiesWin, message}: {isSpiesWin: boolean, message: string}): void => {
	clearTeamTimer(game);
	game.round.phase = EGamePhase.over;
	// Роли открываются всем: партия кончилась, и разбор без них невозможен.
	game.round.isRolesRevealed = true;
	game.end(message, {isSpiesWin});
};

/** Пустое состояние партии: с него начинается игра и им же она заводится. */
export const createRoundState = (leaderId: string) => ({
	phase: EGamePhase.teamBuilding,
	missionIndex: 0,
	missionResults: new Array(MISSIONS_COUNT).fill(null) as (boolean | null)[],
	missionFails: new Array(MISSIONS_COUNT).fill(null) as (number | null)[],
	leaderId,
	rejectCount: 0,
	team: [] as string[],
	votes: {} as Record<string, boolean>,
	missionCards: {} as Record<string, boolean>,
	revealedVotes: null,
	isRolesRevealed: false,
});
