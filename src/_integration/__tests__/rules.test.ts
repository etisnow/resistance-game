import {describe, expect, it} from 'bun:test';
import {gameServer} from 'server/server/GameServer';
import {createMockSocket, createMockSocketServer} from '_integration/mockSocket';
import {buildTeam, createRoundGame, playMission, playRound, seat, voteAll} from '_integration/createRoundGame';
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
