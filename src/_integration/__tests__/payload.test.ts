import {describe, expect, it} from 'bun:test';
import {gameServer} from 'server/server/GameServer';
import {getSpyCalls, createMockSocket} from '_integration/mockSocket';
import {
	assassinOf,
	buildTeam,
	createRoundGame,
	merlinOf,
	morganaOf,
	percivalOf,
	voteAll,
} from '_integration/createRoundGame';
import {Player} from 'server/models/Player';
import {EServerEventType} from 'shared/enum/enumServerEvents';
import {EGamePhase} from 'shared/enum/phase';
import {ENotificationAction} from 'shared/enum/notifications';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {ACTION, revealPause} from 'server/helpers/round';

// Что уезжает игроку в обновлении стола. Тайна партии держится здесь: если она
// протечёт в payload, никакой интерфейс её уже не спрячет.

interface IPlayerView {
	isSpy: boolean | null;
	isMerlin: boolean | null;
	isAssassin: boolean | null;
	isPercival: boolean | null;
	isMorgana: boolean | null;
	looksLikeMerlin: boolean | null;
}

interface IUpdate {
	players: Record<string, IPlayerView | null>;
	round: {
		phase: EGamePhase;
		answeredIds: string[];
		revealedVotes: Record<string, boolean> | null;
		team: string[];
		teamSize: number;
		failsNeeded: number;
		missionFails: (number | null)[];
		missionTeamSizes: number[];
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

describe('FR-14: кто кого видит в партии с Мерлином', () => {
	it('Мерлин знает стороны всех, но не знает, кто из шпионов стреляет', () => {
		const [game, players] = createRoundGame({seed: 8, withMerlin: true});
		const merlin = merlinOf(game);
		game.updateGame();

		// Стороны — все: в этом и есть роль Мерлина.
		expect(seenRoles(merlin, game)).toEqual(players.map((p) => p.isSpy));
		// А вот Убийца ему не виден: иначе половина развязки читалась бы заранее.
		const merlinView = lastUpdate(merlin).players;
		players.filter((p) => p !== merlin).forEach((other) => {
			expect(merlinView[other.id]?.isAssassin).toBeNull();
		});
	});

	it('Мерлина до развязки не знает никто, включая шпионов', () => {
		const [game, players] = createRoundGame({seed: 8, withMerlin: true});
		const merlin = merlinOf(game);
		const assassin = assassinOf(game);
		game.updateGame();

		players.filter((p) => p !== merlin).forEach((viewer) => {
			expect(lastUpdate(viewer).players[merlin.id]?.isMerlin).toBeNull();
		});
		// Сам Мерлин про себя знает — иначе играть за него нечем.
		expect(lastUpdate(merlin).players[merlin.id]?.isMerlin).toBe(true);
		// Шпионы знают, кто из них Убийца: стреляет один, а решают вместе.
		expect(lastUpdate(assassin).players[assassin.id]?.isAssassin).toBe(true);
		const otherSpy = players.find((p) => p.isSpy && p !== assassin)!;
		expect(lastUpdate(otherSpy).players[assassin.id]?.isAssassin).toBe(true);
	});

	it('Персиваль видит двоих одинаково и не знает, кто из них Мерлин', () => {
		const [game, players] = createRoundGame({seed: 9, withPercival: true});
		const percival = percivalOf(game);
		const merlin = merlinOf(game);
		const morgana = morganaOf(game);
		game.updateGame();
		const view = lastUpdate(percival).players;

		// Мерлин и Моргана — на одно лицо: в этом вся роль Морганы.
		expect(view[merlin.id]?.looksLikeMerlin).toBe(true);
		expect(view[morgana.id]?.looksLikeMerlin).toBe(true);
		// И ни настоящих ролей, ни сторон Персивалю не видно — он обычный
		// сопротивленец, просто с догадкой.
		expect(view[merlin.id]?.isMerlin).toBeNull();
		expect(view[morgana.id]?.isMorgana).toBeNull();
		expect(view[morgana.id]?.isSpy).toBeNull();
		// Остальные для него — просто остальные.
		players.filter((p) => p !== merlin && p !== morgana).forEach((other) => {
			expect(view[other.id]?.looksLikeMerlin).toBe(false);
		});
	});

	it('Персиваля не видит никто, а Моргану — только свои', () => {
		const [game, players] = createRoundGame({seed: 9, withPercival: true});
		const percival = percivalOf(game);
		const morgana = morganaOf(game);
		const assassin = assassinOf(game);
		const merlin = merlinOf(game);
		game.updateGame();

		// Знай шпионы Персиваля, они бы через него вышли на Мерлина.
		players.filter((p) => p !== percival).forEach((viewer) => {
			expect(lastUpdate(viewer).players[percival.id]?.isPercival).toBeNull();
		});
		expect(lastUpdate(percival).players[percival.id]?.isPercival).toBe(true);
		// Свои Моргану знают, Мерлин — нет: ему видно только сторону.
		expect(lastUpdate(assassin).players[morgana.id]?.isMorgana).toBe(true);
		expect(lastUpdate(merlin).players[morgana.id]?.isMorgana).toBeNull();
		expect(lastUpdate(merlin).players[morgana.id]?.isSpy).toBe(true);
		// А догадка Персиваля — только его: остальным она не приходит вовсе.
		expect(lastUpdate(assassin).players[merlin.id]?.looksLikeMerlin).toBeNull();
	});

	it('на развязке открывается и Мерлин, и Убийца', () => {
		const [game, players] = createRoundGame({seed: 8, withMerlin: true});
		const merlin = merlinOf(game);
		const assassin = assassinOf(game);
		const clean = players.find((p) => !p.isSpy && p !== merlin)!;
		// Пять отклонений подряд — партия кончается, роли открываются.
		for (let i = 0; i < 5; i++) {
			buildTeam(game, [players[0]!, players[1]!]);
			voteAll(game, 0);
		}
		expect(game.round.phase).toBe(EGamePhase.over);
		expect(lastUpdate(clean).players[merlin.id]?.isMerlin).toBe(true);
		expect(lastUpdate(clean).players[assassin.id]?.isAssassin).toBe(true);
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

	// Жетоны живут ровно паузу вскрытия: пока стол на них смотрит — видны все
	// поимённо, а дальше гаснут разом, вместе с переходом хода.
	it('на паузе голоса видны поимённо, после неё гаснут все', async () => {
		const [game, players] = createRoundGame();
		revealPause.votes = 0.05;
		try {
			buildTeam(game, [players[0]!, players[1]!]);
			voteAll(game, 3);

			const revealed = lastUpdate(players[4]!);
			expect(revealed.round.phase).toBe(EGamePhase.voting);
			expect(revealed.round.revealedVotes).toEqual({
				[players[0]!.id]: true,
				[players[1]!.id]: true,
				[players[2]!.id]: true,
				[players[3]!.id]: false,
				[players[4]!.id]: false,
			});

			await new Promise((resolve) => setTimeout(resolve, 200));
			const after = lastUpdate(players[4]!);
			expect(after.round.phase).toBe(EGamePhase.mission);
			expect(after.round.revealedVotes).toBeNull();
		} finally {
			revealPause.votes = 0;
		}
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
		expect(update.round.missionFails[0]).toBe(1);
		expect(update.round.missionResults[0]).toBe(false);
		expect(JSON.stringify(update.round)).not.toContain('missionCards');
	});

	// Трек рисует точками, сколько человек ходило на каждую миссию, — размеры
	// команд считает сервер, у клиента таблиц правил нет.
	it('в обновлении есть размеры команд всех пяти миссий', () => {
		const [game, players] = createRoundGame();
		expect(game.seatedPlayers().length).toBe(5);
		expect(lastUpdate(players[0]!).round.missionTeamSizes).toEqual([2, 3, 2, 3, 3]);
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
