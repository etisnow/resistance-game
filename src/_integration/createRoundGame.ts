import {gameServer} from 'server/server/GameServer';
import {createMockSocket, createMockSocketServer} from '_integration/mockSocket';
import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {ACTION, revealPause} from 'server/helpers/round';

// Стол на нужное число игроков для сценариев движка. Места здесь не тасуются
// (мок-режим), поэтому порядок игроков — тот же, в котором они садились, а
// первым лидером выходит первый из них.
export const createRoundGame = ({playersCount = 5, seed = 1}: {playersCount?: number, seed?: number} = {}): [Game, Player[]] => {
	gameServer.isMock = true;
	gameServer.ignoreChecks = true;
	// Паузы на вскрытых голосах и на итоге миссии — для живых глаз; спеки ходят
	// синхронно и ждать их на каждом раунде не должны.
	revealPause.votes = 0;
	revealPause.mission = 0;
	gameServer.initialize(createMockSocketServer());
	gameServer.games = {};

	const [game, host] = gameServer.createGame({nickname: 'Игрок 1', socket: createMockSocket(true)});
	for (let i = 2; i <= playersCount; i++) {
		gameServer.connectGame({socket: createMockSocket(true), gameId: game.id, nickname: `Игрок ${i}`});
	}
	game.reseed(seed);
	gameServer.forceStartGame({player: host});
	return [game, game.playersList.map((id) => game.players[id] as Player)];
};

/** Игрок за столом по его месту (0 — первый севший). */
export const seat = (game: Game, index: number): Player => {
	const player = game.players[game.playersList[index] ?? ''];
	if (!player) throw new Error(`Нет игрока на месте ${index}`);
	return player;
};

export const leaderOf = (game: Game): Player => {
	const leader = game.players[game.round.leaderId];
	if (!leader) throw new Error('Нет лидера');
	return leader;
};

/** Лидер набирает названных игроков и подтверждает состав. */
export const buildTeam = (game: Game, team: Player[], {confirm = true} = {}): void => {
	team.forEach((member) => {
		gameServer.playerAction({
			player: leaderOf(game),
			actionType: EPlayerActionType.playerSelect,
			selectedPlayerId: member.id,
		});
	});
	if (!confirm) return;
	gameServer.playerAction({
		player: leaderOf(game),
		actionType: EPlayerActionType.actionDecision,
		action: ACTION.confirmTeam,
	});
};

/**
 * Голосуют все. approvals — сколько голосов «за»; остальные против. Порядок —
 * по местам за столом, чтобы сценарий читался.
 */
export const voteAll = (game: Game, approvals: number): void => {
	game.seatedPlayers().forEach((player, index) => {
		gameServer.playerAction({
			player,
			actionType: EPlayerActionType.actionDecision,
			action: index < approvals ? ACTION.approve : ACTION.reject,
		});
	});
};

/** Команда сдаёт карты: fails — сколько провалов (их сдают первые в составе). */
export const playMission = (game: Game, fails: number): void => {
	const team = [...game.round.team];
	team.forEach((playerId, index) => {
		const player = game.players[playerId];
		if (!player) return;
		gameServer.playerAction({
			player,
			actionType: EPlayerActionType.actionDecision,
			action: index < fails ? ACTION.fail : ACTION.success,
		});
	});
};

/** Провести раунд целиком: состав, единогласное «за», названное число провалов. */
export const playRound = (game: Game, {team, fails}: {team: Player[], fails: number}): void => {
	buildTeam(game, team);
	voteAll(game, game.seatedPlayers().length);
	playMission(game, fails);
};
