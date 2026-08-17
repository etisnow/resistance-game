import {describe, expect, it} from 'bun:test';
import {gameServer} from 'server/server/GameServer';
import {createMockSocket, createMockSocketServer, getSpyCalls} from '_integration/mockSocket';
import {
	aim,
	assassinOf,
	buildTeam,
	createRoundGame,
	merlinOf,
	morganaOf,
	percivalOf,
	playMission,
	playRound,
	seat,
	shoot,
	voteAll,
} from '_integration/createRoundGame';
import type INotificationAction from 'shared/interfaces/notification';
import {EServerEventType} from 'shared/enum/enumServerEvents';
import {ESpecialRole, parseDevRole} from 'shared/enum/role';
import {EGamePhase} from 'shared/enum/phase';
import {EGameState} from 'shared/enum/common';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {ACTION, revealPause} from 'server/helpers/round';
import {spyCount, teamSize} from 'shared/constant/resistance';
import {ENotificationAction} from 'shared/enum/notifications';

// Ядро правил «Сопротивления». Каждый сценарий проверяет требование из
// docs/PRD.md — номер FR стоит в названии. Сид фиксирован везде: партия обязана
// быть воспроизводимой, иначе падение теста не повторить.

const makeLobby = (playersCount: number) => {
	gameServer.isMock = true;
	gameServer.ignoreChecks = true;
	gameServer.initialize(createMockSocketServer());
	gameServer.games = {};
	const [game, host] = gameServer.createGame({nickname: 'Хост', socket: createMockSocket(true)});
	for (let i = 2; i <= playersCount; i++) {
		gameServer.connectGame({socket: createMockSocket(true), gameId: game.id, nickname: `Игрок ${i}`});
	}
	return {game, host};
};

describe('FR-1: партия идёт впятером-вдесятером', () => {
	it('вчетвером игра не начинается', () => {
		const {game, host} = makeLobby(4);
		gameServer.forceStartGame({player: host});
		expect(game.state).toBe(EGameState.lobby);
	});

	it('вдесятером начинается, а одиннадцатый лишний', () => {
		const {game: ten, host: tenHost} = makeLobby(10);
		gameServer.forceStartGame({player: tenHost});
		expect(ten.state).toBe(EGameState.sarted);

		const {game: eleven, host: elevenHost} = makeLobby(11);
		gameServer.forceStartGame({player: elevenHost});
		expect(eleven.state).toBe(EGameState.lobby);
	});
});

describe('FR-2: роли раздаются по таблице состава', () => {
	it('шпионов столько, сколько положено за таким столом', () => {
		for (const playersCount of [5, 6, 7, 8, 9, 10]) {
			const [game] = createRoundGame({playersCount, seed: playersCount});
			const spies = game.seatedPlayers().filter((p) => p.isSpy);
			expect(spies).toHaveLength(spyCount(playersCount));
		}
	});

	// Шпионы садились строго на первые места, и партия читалась с одного взгляда.
	// Виновата была тасовка на месте: рассадку и роли тасовал один и тот же
	// массив, и вторая тасовка переставляла стол уже под выбранных шпионов.
	it('шпионы садятся куда попало, а не в начало стола', () => {
		const seats = new Set<number>();
		for (let seed = 1; seed <= 30; seed++) {
			const [game] = createRoundGame({playersCount: 5, seed});
			game.playersList.forEach((playerId, index) => {
				if (game.players[playerId]?.isSpy) seats.add(index);
			});
		}
		expect([...seats].sort()).toEqual([0, 1, 2, 3, 4]);
	});

	it('сид повторяет ту же раздачу', () => {
		const rolesOf = () => {
			const [game] = createRoundGame({playersCount: 7, seed: 42});
			return game.playersList.map((id) => !!game.players[id]?.isSpy);
		};
		expect(rolesOf()).toEqual(rolesOf());
	});
});

describe('FR-3: лидер и передача карты лидера', () => {
	it('партия начинается с набора команды, лидер спрошен первым', () => {
		const [game, players] = createRoundGame();
		expect(game.round.phase).toBe(EGamePhase.teamBuilding);
		expect(game.round.leaderId).toBe(players[0]!.id);
		// Прицел стола наведён на лидера, и спрашивают именно его.
		expect(game.turnPlayerId).toBe(players[0]!.id);
		expect(players[0]!.currentAction?.type).toBe(ENotificationAction.playerSelect);
		expect(players[1]!.currentAction).toBeNull();
	});

	it('после отклонения команды лидер уходит к следующему по кругу', () => {
		const [game, players] = createRoundGame();
		buildTeam(game, [players[0]!, players[1]!]);
		voteAll(game, 0);
		expect(game.round.leaderId).toBe(players[1]!.id);
		expect(game.round.phase).toBe(EGamePhase.teamBuilding);
	});

	it('после сыгранной миссии лидер тоже уходит дальше', () => {
		const [game, players] = createRoundGame();
		playRound(game, {team: [players[0]!, players[1]!], fails: 0});
		expect(game.round.leaderId).toBe(players[1]!.id);
	});
});

describe('FR-4: лидер набирает ровно нужное число игроков', () => {
	it('состав подтверждается только целиком, и лидер может набрать заново', () => {
		const [game, players] = createRoundGame();
		expect(teamSize(5, 0)).toBe(2);

		// Неполный состав подтвердить нельзя — вопроса ещё и не задавали.
		buildTeam(game, [players[0]!], {confirm: false});
		gameServer.playerAction({player: players[0]!, actionType: EPlayerActionType.actionDecision, action: ACTION.confirmTeam});
		expect(game.round.phase).toBe(EGamePhase.teamBuilding);

		// Набираем второго — теперь спрашивают подтверждение.
		buildTeam(game, [players[1]!], {confirm: false});
		expect(players[0]!.currentAction?.type).toBe(ENotificationAction.actionDecision);

		// «Заново» очищает состав и возвращает к выбору.
		gameServer.playerAction({player: players[0]!, actionType: EPlayerActionType.actionDecision, action: ACTION.resetTeam});
		expect(game.round.team).toEqual([]);
		expect(players[0]!.currentAction?.type).toBe(ENotificationAction.playerSelect);
	});

	it('команду набирает только лидер', () => {
		const [game, players] = createRoundGame();
		// Не лидер шлёт выбор напрямую — состав не меняется.
		gameServer.playerAction({player: players[1]!, actionType: EPlayerActionType.playerSelect, selectedPlayerId: players[2]!.id});
		expect(game.round.team).toEqual([]);
	});

	it('одного и того же игрока дважды в команду не взять', () => {
		const [game, players] = createRoundGame();
		buildTeam(game, [players[0]!, players[0]!], {confirm: false});
		expect(game.round.team).toEqual([players[0]!.id]);
	});
});

describe('FR-5, FR-6: голосуют все, решает строгое большинство', () => {
	it('спрашивают весь стол, включая саму команду', () => {
		const [game, players] = createRoundGame();
		buildTeam(game, [players[0]!, players[1]!]);
		expect(game.round.phase).toBe(EGamePhase.voting);
		game.seatedPlayers().forEach((player) => {
			expect(player.currentAction?.type).toBe(ENotificationAction.actionDecision);
		});
	});

	it('большинство «за» отправляет команду на миссию', () => {
		const [game, players] = createRoundGame();
		buildTeam(game, [players[0]!, players[1]!]);
		voteAll(game, 3);
		expect(game.round.phase).toBe(EGamePhase.mission);
	});

	it('ничья — это отклонение', () => {
		const [game, players] = createRoundGame({playersCount: 6});
		buildTeam(game, [players[0]!, players[1]!]);
		voteAll(game, 3);
		expect(game.round.phase).toBe(EGamePhase.teamBuilding);
		expect(game.round.rejectCount).toBe(1);
	});

	it('второй голос того же игрока не считается', () => {
		const [game, players] = createRoundGame();
		buildTeam(game, [players[0]!, players[1]!]);
		gameServer.playerAction({player: players[0]!, actionType: EPlayerActionType.actionDecision, action: ACTION.approve});
		gameServer.playerAction({player: players[0]!, actionType: EPlayerActionType.actionDecision, action: ACTION.reject});
		expect(game.round.votes[players[0]!.id]).toBe(true);
		expect(Object.keys(game.round.votes)).toHaveLength(1);
	});
});

describe('FR-7: пять отклонений подряд отдают партию шпионам', () => {
	it('пятое отклонение заканчивает партию', () => {
		const [game] = createRoundGame();
		for (let i = 0; i < 4; i++) {
			expect(game.round.phase).toBe(EGamePhase.teamBuilding);
			expect(game.round.rejectCount).toBe(i);
			// Лидер каждый раз новый, а состав предлагает один и тот же — столу он
			// всё равно не нравится.
			buildTeam(game, [seat(game, 0), seat(game, 1)]);
			voteAll(game, 0);
		}
		expect(game.round.rejectCount).toBe(4);

		buildTeam(game, [seat(game, 0), seat(game, 1)]);
		voteAll(game, 0);
		expect(game.round.phase).toBe(EGamePhase.over);
		// Партия кончилась, не сыграв ни одной миссии.
		expect(game.round.missionResults).toEqual([null, null, null, null, null]);
		expect(game.gameLog.map((entry) => entry.text).join(' ')).toContain('шпионы победили');
	});

	it('счётчик обнуляется, как только миссия сыграна', () => {
		const [game, players] = createRoundGame();
		buildTeam(game, [players[0]!, players[1]!]);
		voteAll(game, 0);
		expect(game.round.rejectCount).toBe(1);

		buildTeam(game, [players[1]!, players[2]!]);
		voteAll(game, 5);
		playMission(game, 0);
		expect(game.round.rejectCount).toBe(0);
	});
});

describe('FR-8: провал доступен только шпиону', () => {
	it('сопротивленцу провал не предлагают и не принимают', () => {
		const [game, players] = createRoundGame();
		const clean = players.find((p) => !p.isSpy)!;
		const spy = players.find((p) => p.isSpy)!;

		buildTeam(game, [clean, spy]);
		voteAll(game, 5);

		const cleanMenu = clean.currentAction?.type === ENotificationAction.actionDecision ? clean.currentAction.menu : [];
		const spyMenu = spy.currentAction?.type === ENotificationAction.actionDecision ? spy.currentAction.menu : [];
		expect(cleanMenu.map((item) => item.action)).toEqual([ACTION.success]);
		expect(spyMenu.map((item) => item.action)).toEqual([ACTION.fail, ACTION.success]);

		// Событие мимо интерфейса тоже не проходит.
		gameServer.playerAction({player: clean, actionType: EPlayerActionType.actionDecision, action: ACTION.fail});
		expect(game.round.missionCards[clean.id]).toBeUndefined();
		expect(game.round.phase).toBe(EGamePhase.mission);
	});

	it('в миссии участвует только команда', () => {
		const [game, players] = createRoundGame();
		buildTeam(game, [players[0]!, players[1]!]);
		voteAll(game, 5);
		gameServer.playerAction({player: players[2]!, actionType: EPlayerActionType.actionDecision, action: ACTION.success});
		expect(game.round.missionCards[players[2]!.id]).toBeUndefined();
	});
});

// Паузы не про правила, а про глаза: без них последний ответ переключал фазу в
// тот же миг и вскрытое не успевало показаться.
describe('вскрытое стол успевает прочитать', () => {
	it('после последнего голоса ход держит паузу', async () => {
		const [game, players] = createRoundGame();
		revealPause.votes = 0.05;
		try {
			buildTeam(game, [players[0]!, players[1]!]);
			voteAll(game, 5);

			// Голоса уже вскрыты, а фаза ещё голосование: стол смотрит на них.
			expect(game.round.revealedVotes).not.toBeNull();
			expect(game.round.phase).toBe(EGamePhase.voting);

			await new Promise((resolve) => setTimeout(resolve, 200));
			expect(game.round.phase).toBe(EGamePhase.mission);
		} finally {
			revealPause.votes = 0;
		}
	});

	it('после последней карты миссия оглашается и только потом идёт дальше', async () => {
		const [game, players] = createRoundGame();
		revealPause.mission = 0.05;
		try {
			buildTeam(game, [players[0]!, players[1]!]);
			voteAll(game, 5);
			playMission(game, 0);

			// Исход уже проставлен, но номер миссии ещё не переехал: по нему стол и
			// оглашает, чем всё кончилось.
			expect(game.round.missionResults[0]).toBe(true);
			expect(game.round.missionIndex).toBe(0);
			expect(game.round.phase).toBe(EGamePhase.mission);

			await new Promise((resolve) => setTimeout(resolve, 200));
			expect(game.round.missionIndex).toBe(1);
			expect(game.round.phase).toBe(EGamePhase.teamBuilding);
		} finally {
			revealPause.mission = 0;
		}
	});
});

describe('FR-9: миссия вскрывается числом провалов', () => {
	it('одного провала хватает, чтобы сорвать обычную миссию', () => {
		const [game, players] = createRoundGame();
		players.forEach((player) => { player.isSpy = true; });
		playRound(game, {team: [players[0]!, players[1]!], fails: 1});
		expect(game.round.missionResults[0]).toBe(false);
		expect(game.round.missionFails[0]).toBe(1);
	});

	it('четвёртая миссия при семи игроках требует двух провалов', () => {
		const [game, players] = createRoundGame({playersCount: 7});
		players.forEach((player) => { player.isSpy = true; });

		// Доходим до четвёртой миссии, не выиграв партию раньше: два успеха и
		// провал между ними.
		playRound(game, {team: game.seatedPlayers().slice(0, 2), fails: 0});
		playRound(game, {team: game.seatedPlayers().slice(0, 3), fails: 1});
		expect(game.round.missionIndex).toBe(2);
		playRound(game, {team: game.seatedPlayers().slice(0, 3), fails: 0});
		expect(game.round.missionIndex).toBe(3);

		// Один провал четвёртую не срывает.
		playRound(game, {team: game.seatedPlayers().slice(0, 4), fails: 1});
		expect(game.round.missionResults[3]).toBe(true);
		// Счёт провалов помнится по всем сыгранным миссиям, а не только по последней.
		expect(game.round.missionFails.slice(0, 4)).toEqual([0, 1, 0, 1]);
	});

	it('два провала четвёртую при семи игроках срывают', () => {
		const [game, players] = createRoundGame({playersCount: 7});
		players.forEach((player) => { player.isSpy = true; });
		playRound(game, {team: game.seatedPlayers().slice(0, 2), fails: 0});
		playRound(game, {team: game.seatedPlayers().slice(0, 3), fails: 0});
		playRound(game, {team: game.seatedPlayers().slice(0, 3), fails: 1});
		expect(game.round.missionIndex).toBe(3);
		playRound(game, {team: game.seatedPlayers().slice(0, 4), fails: 2});
		expect(game.round.missionResults[3]).toBe(false);
	});
});

describe('FR-10: три миссии решают партию', () => {
	it('три успеха — победа сопротивления, роли раскрыты', () => {
		const [game, players] = createRoundGame();
		playRound(game, {team: [players[0]!, players[1]!], fails: 0});
		playRound(game, {team: [players[1]!, players[2]!, players[3]!], fails: 0});
		playRound(game, {team: [players[2]!, players[3]!], fails: 0});

		expect(game.round.phase).toBe(EGamePhase.over);
		expect(game.round.missionResults.slice(0, 3)).toEqual([true, true, true]);
		expect(game.round.isRolesRevealed).toBe(true);
		expect(game.gameLog.map((entry) => entry.text).join(' ')).toContain('сопротивление победило');
	});

	it('три провала — победа шпионов', () => {
		const [game, players] = createRoundGame();
		players.forEach((player) => { player.isSpy = true; });
		playRound(game, {team: [players[0]!, players[1]!], fails: 1});
		playRound(game, {team: [players[1]!, players[2]!, players[3]!], fails: 1});
		playRound(game, {team: [players[2]!, players[3]!], fails: 1});

		expect(game.round.phase).toBe(EGamePhase.over);
		expect(game.round.missionResults.slice(0, 3)).toEqual([false, false, false]);
		expect(game.gameLog.map((entry) => entry.text).join(' ')).toContain('шпионы победили');
	});
});

// Партия с Мерлином и Убийцей — отдельная настройка стола (Game.withMerlin), а не
// новые правила поверх старых: без неё за столом по-прежнему только две стороны.
const winThreeMissions = ([game, players]: ReturnType<typeof createRoundGame>): void => {
	playRound(game, {team: [players[0]!, players[1]!], fails: 0});
	playRound(game, {team: [players[1]!, players[2]!, players[3]!], fails: 0});
	playRound(game, {team: [players[2]!, players[3]!], fails: 0});
};

const targetsOf = (player: {currentAction: INotificationAction | null}): string[] => {
	const action = player.currentAction;
	if (!action || action.type !== ENotificationAction.playerSelect) return [];
	return [...action.playersToSelect].sort();
};

describe('FR-14: Мерлин видит шпионов', () => {
	it('без настройки партии особых ролей за столом нет', () => {
		const [game] = createRoundGame({seed: 11});
		expect(game.seatedPlayers().some((player) => player.isMerlin || player.isAssassin)).toBe(false);
	});

	it('Мерлин один и он из сопротивления, Убийца один и он шпион', () => {
		for (const playersCount of [5, 7, 10]) {
			const [game] = createRoundGame({playersCount, seed: playersCount, withMerlin: true});
			const merlins = game.seatedPlayers().filter((player) => player.isMerlin);
			const assassins = game.seatedPlayers().filter((player) => player.isAssassin);
			expect(merlins).toHaveLength(1);
			expect(assassins).toHaveLength(1);
			expect(merlins[0]!.isSpy).toBe(false);
			expect(assassins[0]!.isSpy).toBe(true);
			// Состав стола от дополнения не меняется: шпионов столько же, сколько было.
			expect(game.seatedPlayers().filter((player) => player.isSpy)).toHaveLength(spyCount(playersCount));
		}
	});

	it('роли не проговариваются вслух: о них говорит только сам стол', () => {
		const [game, players] = createRoundGame({seed: 4, withMerlin: true});
		const merlin = merlinOf(game);
		// Лог общий — имени Мерлина в нём быть не может.
		expect(game.gameLog.map((entry) => entry.text).join(' ')).not.toContain(merlin.nickname);
		// И личных сообщений о роли на старте тоже нет: роль рассказывает жетон на
		// кружке и подсказка по нему (см. client/components/hint/RoleHint).
		const startNotifications = players.flatMap((player) => (
			getSpyCalls(player)
				.filter(([type]) => type === EServerEventType.notification)
				.map(([, payload]) => (payload as {type?: string}).type ?? '')
		));
		expect(startNotifications).not.toContain(ENotificationAction.info);
	});
});

describe('FR-16: Персиваль и Моргана', () => {
	it('без своей настройки их нет даже в партии с Мерлином', () => {
		const [game] = createRoundGame({seed: 12, withMerlin: true});
		expect(game.seatedPlayers().some((player) => player.isPercival || player.isMorgana)).toBe(false);
	});

	it('Персиваль из сопротивления и не Мерлин, Моргана из шпионов и не Убийца', () => {
		for (const playersCount of [5, 7, 10]) {
			const [game] = createRoundGame({playersCount, seed: playersCount, withPercival: true});
			const percival = percivalOf(game);
			const morgana = morganaOf(game);
			expect(percival.isSpy).toBe(false);
			expect(percival.isMerlin).toBe(false);
			expect(morgana.isSpy).toBe(true);
			expect(morgana.isAssassin).toBe(false);
			// Состав стола от пары не меняется: шпионов по-прежнему по таблице.
			expect(game.seatedPlayers().filter((player) => player.isSpy)).toHaveLength(spyCount(playersCount));
			expect(game.seatedPlayers().filter((player) => player.isPercival)).toHaveLength(1);
			expect(game.seatedPlayers().filter((player) => player.isMorgana)).toHaveLength(1);
		}
	});

	it('пара без Мерлина не берётся: настройка вложенная', () => {
		const {game, host} = makeLobby(5);
		gameServer.setGameOptions({player: host, withPercival: true});
		// Мерлина не просили — значит и пары нет.
		expect(game.withMerlin).toBe(false);
		expect(game.withPercival).toBe(false);

		gameServer.setGameOptions({player: host, withMerlin: true});
		gameServer.setGameOptions({player: host, withPercival: true});
		expect(game.withPercival).toBe(true);
		// Сняли Мерлина — пара уходит с ним, а не остаётся висеть.
		gameServer.setGameOptions({player: host, withMerlin: false});
		expect(game.withPercival).toBe(false);
	});

	it('Убийца стреляет и в Персиваля — он такое же сопротивление', () => {
		const game = createRoundGame({seed: 6, withPercival: true});
		winThreeMissions(game);
		const [gameState] = game;
		expect(targetsOf(assassinOf(gameState))).toContain(percivalOf(gameState).id);
		// А в Моргану — нет: она своя.
		expect(targetsOf(assassinOf(gameState))).not.toContain(morganaOf(gameState).id);
	});
});

// Дев-режим: `?withBots=true&activeRole=merlin` выдаёт роль тому, кто её просил.
// Правилам это не относится, но состав стола ломать не должно — иначе проверять
// руками нечего.
describe('?activeRole= выдаёт роль живому игроку', () => {
	const botGame = (activeRole: string, seed = 3) => {
		gameServer.isMock = true;
		gameServer.ignoreChecks = true;
		gameServer.initialize(createMockSocketServer());
		gameServer.games = {};
		const [game] = gameServer.createGame({
			nickname: 'Человек',
			socket: createMockSocket(true),
			bots: {withBots: true, seed, activeRole},
		});
		const human = game.seatedPlayers().find((player) => !player.isBot)!;
		return {game, human};
	};

	it('просьба про Мерлина включает и саму партию с ним', () => {
		const {game, human} = botGame('merlin');
		expect(game.withMerlin).toBe(true);
		expect(human.isMerlin).toBe(true);
		expect(human.isSpy).toBe(false);
	});

	it('Убийца достаётся просившему вместе со стороной шпионов', () => {
		const {game, human} = botGame('assassin');
		expect(human.isAssassin).toBe(true);
		expect(human.isSpy).toBe(true);
		expect(game.seatedPlayers().filter((player) => player.isAssassin)).toHaveLength(1);
	});

	it('состав стола от подмены не меняется', () => {
		for (const role of ['merlin', 'assassin']) {
			const {game} = botGame(role);
			const playersCount = game.seatedPlayers().length;
			expect(game.seatedPlayers().filter((player) => player.isSpy)).toHaveLength(spyCount(playersCount));
			expect(game.seatedPlayers().filter((player) => player.isMerlin)).toHaveLength(1);
			expect(game.seatedPlayers().filter((player) => player.isAssassin)).toHaveLength(1);
		}
	});

	it('мусор в параметре не заводит партию с Мерлином', () => {
		const {game, human} = botGame('дракон');
		expect(game.withMerlin).toBe(false);
		expect(human.isMerlin).toBe(false);
		expect(game.seatedPlayers().some((player) => player.isAssassin)).toBe(false);
	});

	it('«marlin» понимается как «merlin»: в этом слове ошибаются', () => {
		expect(parseDevRole('marlin')).toBe(ESpecialRole.merlin);
		expect(parseDevRole(' MERLIN ')).toBe(ESpecialRole.merlin);
		expect(parseDevRole('assassin')).toBe(ESpecialRole.assassin);
		expect(parseDevRole('')).toBeNull();
		expect(parseDevRole(undefined)).toBeNull();
	});
});

describe('FR-15: у шпионов остаётся выстрел Убийцы', () => {
	it('три успеха партию не заканчивают: слово за Убийцей', () => {
		const game = createRoundGame({seed: 5, withMerlin: true});
		winThreeMissions(game);
		const assassin = assassinOf(game[0]);

		expect(game[0].round.phase).toBe(EGamePhase.assassination);
		// Роли ещё закрыты: партия не кончена, и выстрел делают вслепую.
		expect(game[0].round.isRolesRevealed).toBe(false);
		expect(assassin.currentAction?.type).toBe(ENotificationAction.playerSelect);
		// Прицел стола — на Убийце: ход теперь его.
		expect(game[0].turnPlayerId).toBe(assassin.id);
		// Стрелять есть по кому только среди сопротивления: своих Убийца знает.
		expect(targetsOf(assassin)).toEqual(
			game[0].seatedPlayers().filter((player) => !player.isSpy).map((player) => player.id).sort(),
		);
	});

	it('наводка не стреляет: сначала цель, потом кнопка', () => {
		const game = createRoundGame({seed: 5, withMerlin: true});
		winThreeMissions(game);
		const [gameState] = game;
		const merlin = merlinOf(gameState);
		aim(gameState, merlin);

		// Прицел наведён и виден столу, но партия ещё идёт: выстрела не было.
		expect(gameState.round.assassinAimId).toBe(merlin.id);
		expect(gameState.round.assassinTargetId).toBeNull();
		expect(gameState.round.phase).toBe(EGamePhase.assassination);
		// Убийце теперь предлагают нажать — это уже вопрос с кнопками.
		expect(assassinOf(gameState).currentAction?.type).toBe(ENotificationAction.actionDecision);
	});

	it('«выбрать другого» снимает прицел и возвращает к выбору', () => {
		const game = createRoundGame({seed: 5, withMerlin: true});
		winThreeMissions(game);
		const [gameState] = game;
		const assassin = assassinOf(gameState);
		aim(gameState, merlinOf(gameState));
		gameServer.playerAction({
			player: assassin,
			actionType: EPlayerActionType.actionDecision,
			action: ACTION.resetAim,
		});

		expect(gameState.round.assassinAimId).toBeNull();
		expect(gameState.round.assassinTargetId).toBeNull();
		expect(assassin.currentAction?.type).toBe(ENotificationAction.playerSelect);
	});

	it('попал в Мерлина — партия уходит шпионам', () => {
		const game = createRoundGame({seed: 5, withMerlin: true});
		winThreeMissions(game);
		shoot(game[0], merlinOf(game[0]));

		expect(game[0].round.phase).toBe(EGamePhase.over);
		expect(game[0].round.isRolesRevealed).toBe(true);
		expect(game[0].gameLog.map((entry) => entry.text).join(' ')).toContain('Убийца нашёл Мерлина');
	});

	it('промахнулся — сопротивление победило', () => {
		const game = createRoundGame({seed: 5, withMerlin: true});
		winThreeMissions(game);
		const merlin = merlinOf(game[0]);
		const other = game[0].seatedPlayers().find((player) => !player.isSpy && player !== merlin)!;
		shoot(game[0], other);

		expect(game[0].round.phase).toBe(EGamePhase.over);
		expect(game[0].round.assassinTargetId).toBe(other.id);
		expect(game[0].gameLog.map((entry) => entry.text).join(' ')).toContain('Убийца промахнулся');
	});

	it('стреляет только Убийца и только по сопротивлению', () => {
		const game = createRoundGame({seed: 5, withMerlin: true});
		winThreeMissions(game);
		const [gameState] = game;
		const merlin = merlinOf(gameState);
		const assassin = assassinOf(gameState);
		const otherSpy = gameState.seatedPlayers().find((player) => player.isSpy && player !== assassin)!;

		// Чужой выстрел стол не принимает — даже от напарника по шпионажу.
		gameServer.playerAction({
			player: otherSpy,
			actionType: EPlayerActionType.playerSelect,
			selectedPlayerId: merlin.id,
		});
		expect(gameState.round.phase).toBe(EGamePhase.assassination);

		// И по своему стрелять нельзя: этого пункта Убийце и не предлагали.
		gameServer.playerAction({
			player: assassin,
			actionType: EPlayerActionType.playerSelect,
			selectedPlayerId: otherSpy.id,
		});
		expect(gameState.round.phase).toBe(EGamePhase.assassination);
		expect(gameState.round.assassinTargetId).toBeNull();
	});

	it('проигранная сопротивлением партия выстрела не даёт', () => {
		const game = createRoundGame({seed: 5, withMerlin: true});
		const [gameState, players] = game;
		players.forEach((player) => { player.isSpy = true; });
		playRound(gameState, {team: [players[0]!, players[1]!], fails: 1});
		playRound(gameState, {team: [players[1]!, players[2]!, players[3]!], fails: 1});
		playRound(gameState, {team: [players[2]!, players[3]!], fails: 1});

		// Шпионы взяли партию миссиями — стрелять уже не в кого и незачем.
		expect(gameState.round.phase).toBe(EGamePhase.over);
		expect(gameState.round.assassinTargetId).toBeNull();
	});

	it('пять отклонений заканчивают партию сразу, без выстрела', () => {
		const [game, players] = createRoundGame({seed: 5, withMerlin: true});
		for (let i = 0; i < 5; i++) {
			buildTeam(game, [players[0]!, players[1]!]);
			voteAll(game, 0);
		}
		expect(game.round.phase).toBe(EGamePhase.over);
		expect(game.round.assassinTargetId).toBeNull();
	});

	it('без Мерлина три успеха заканчивают партию на месте', () => {
		const game = createRoundGame({seed: 5});
		winThreeMissions(game);
		expect(game[0].round.phase).toBe(EGamePhase.over);
	});
});
