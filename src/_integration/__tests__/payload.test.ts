import {describe, expect, it} from 'bun:test';
import {gameServer} from 'server/server/GameServer';
import {getSpyCalls, createMockSocket} from '_integration/mockSocket';
import {buildTeam, createRoundGame, voteAll} from '_integration/createRoundGame';
import {Player} from 'server/models/Player';
import {EServerEventType} from 'shared/enum/enumServerEvents';
import {EGamePhase} from 'shared/enum/phase';
import {ENotificationAction} from 'shared/enum/notifications';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {ACTION} from 'server/helpers/round';

// Что уезжает игроку в обновлении стола. Тайна партии держится здесь: если она
// протечёт в payload, никакой интерфейс её уже не спрячет.

interface IUpdate {
	players: Record<string, {isSpy: boolean | null} | null>;
	round: {
		phase: EGamePhase;
		answeredIds: string[];
		revealedVotes: Record<string, boolean> | null;
		team: string[];
		teamSize: number;
		failsNeeded: number;
		lastFailCount: number | null;
		missionResults: (boolean | null)[];
		rejectCount: number;
	};
	currentAction: {type: string} | null;
}

const lastUpdate = (player: Player): IUpdate => {
	const updates = getSpyCalls(player).filter(([type]) => type === EServerEventType.updateGame);
	const last = updates[updates.length - 1];
	if (!last) throw new Error(`Игрок ${player.nickname} не получил ни одного обновления`);
	return last[1] as IUpdate;
};

/** Что этот игрок знает о ролях остальных. */
const seenRoles = (viewer: Player, game: {playersList: string[]}): (boolean | null)[] =>
	game.playersList.map((id) => lastUpdate(viewer).players[id]?.isSpy ?? null);

describe('FR-2: роли видно только своим', () => {
	it('сопротивленец видит лишь себя, шпион — всех шпионов', () => {
		const [game, players] = createRoundGame({playersCount: 5, seed: 7});
		const clean = players.find((p) => !p.isSpy)!;
		const spy = players.find((p) => p.isSpy)!;
		game.updateGame();

		// Сопротивленец: про себя знает (не шпион), про остальных — ничего.
		const cleanView = lastUpdate(clean).players;
		expect(cleanView[clean.id]?.isSpy).toBe(false);
		players.filter((p) => p !== clean).forEach((other) => {
			expect(cleanView[other.id]?.isSpy).toBeNull();
		});

		// Шпион видит роли всего стола — иначе он не знал бы напарника.
		const spyView = lastUpdate(spy).players;
		players.forEach((other) => {
			expect(spyView[other.id]?.isSpy).toBe(other.isSpy);
		});
	});

	it('на развязке роли открываются всем', () => {
		const [game, players] = createRoundGame({playersCount: 5, seed: 3});
		const clean = players.find((p) => !p.isSpy)!;
		// Пять отклонений подряд — партия кончается, роли открываются.
		for (let i = 0; i < 5; i++) {
			buildTeam(game, [players[0]!, players[1]!]);
			voteAll(game, 0);
		}
		expect(game.round.phase).toBe(EGamePhase.over);
		expect(seenRoles(clean, game)).toEqual(players.map((p) => p.isSpy));
	});
});

describe('FR-5: голоса не утекают до вскрытия', () => {
	it('пока голосуют, наружу уходит только «кто ответил»', () => {
		const [game, players] = createRoundGame();
		buildTeam(game, [players[0]!, players[1]!]);

		gameServer.playerAction({player: players[0]!, actionType: EPlayerActionType.actionDecision, action: ACTION.approve});
		gameServer.playerAction({player: players[1]!, actionType: EPlayerActionType.actionDecision, action: ACTION.reject});

		const update = lastUpdate(players[2]!);
		expect(update.round.phase).toBe(EGamePhase.voting);
		// Кто ответил — видно, а что именно ответил — нет.
		expect(update.round.answeredIds.sort()).toEqual([players[0]!.id, players[1]!.id].sort());
		expect(update.round.revealedVotes).toBeNull();
		// И в сыром виде голосов в payload нет вовсе.
		expect(JSON.stringify(update.round)).not.toContain('votes"');
	});

	it('после вскрытия голоса видны поимённо', () => {
		const [game, players] = createRoundGame();
		buildTeam(game, [players[0]!, players[1]!]);
		voteAll(game, 3);

		const update = lastUpdate(players[4]!);
		expect(update.round.phase).toBe(EGamePhase.mission);
		expect(update.round.revealedVotes).toEqual({
			[players[0]!.id]: true,
			[players[1]!.id]: true,
			[players[2]!.id]: true,
			[players[3]!.id]: false,
			[players[4]!.id]: false,
		});
	});
});

describe('FR-9: миссия уходит на стол числом, а не поимённо', () => {
	it('в обновлении есть число провалов и нет карт участников', () => {
		const [game, players] = createRoundGame();
		players.forEach((player) => { player.isSpy = true; });
		buildTeam(game, [players[0]!, players[1]!]);
		voteAll(game, 5);
		gameServer.playerAction({player: players[0]!, actionType: EPlayerActionType.actionDecision, action: ACTION.fail});
		gameServer.playerAction({player: players[1]!, actionType: EPlayerActionType.actionDecision, action: ACTION.success});

		const update = lastUpdate(players[3]!);
		expect(update.round.lastFailCount).toBe(1);
		expect(update.round.missionResults[0]).toBe(false);
		expect(JSON.stringify(update.round)).not.toContain('missionCards');
	});
});

describe('FR-12: вернувшийся игрок получает свой вопрос и состояние партии', () => {
	it('реконнект в фазе голосования возвращает вопрос и трек миссий', () => {
		const [game, players] = createRoundGame();
		buildTeam(game, [players[0]!, players[1]!]);
		const voter = players[2]!;
		expect(voter.currentAction?.type).toBe(ENotificationAction.actionDecision);

		// Игрок отвалился и вернулся тем же ником с нового подключения.
		voter.makeOffline();
		const socket = createMockSocket(true);
		gameServer.connectGame({socket, gameId: game.id, nickname: voter.nickname});

		const resent = getSpyCalls(voter).filter(([type]) => type === EServerEventType.notification);
		expect((resent[resent.length - 1]?.[1] as {type: string}).type).toBe(ENotificationAction.actionDecision);

		const update = lastUpdate(voter);
		expect(update.round.phase).toBe(EGamePhase.voting);
		expect(update.round.team).toEqual([players[0]!.id, players[1]!.id]);
		expect(update.round.teamSize).toBe(2);
		expect(update.currentAction?.type).toBe(ENotificationAction.actionDecision);

		// И проголосовать он всё ещё может — вопрос не потерян.
		gameServer.playerAction({player: voter, actionType: EPlayerActionType.actionDecision, action: ACTION.approve});
		expect(game.round.votes[voter.id]).toBe(true);
	});
});
