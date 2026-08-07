import {createMockGameServer} from '_integration/createGameServer';
import {requirePlayer} from '_integration/helpers';
import {EPlayerMark} from 'shared/enum/playerMarks';
import {EEventID} from 'shared/enum/cards';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {
	EAnalyticsDeathCause,
	EAnalyticsEvent,
	EAnalyticsMark,
	EAnalyticsRole,
	EAnalyticsSource,
	EAnalyticsWinner,
	type IAnalyticsMatch,
} from 'shared/analytics/contract';
import {analyticsSink} from 'server/analytics/sink';
import {find} from 'lodash';
import type {Game} from 'server/models/Game';

// Аналитика снимает показания с живого движка: тесты гоняют настоящую партию и
// проверяют, что в пакете оказалось ровно то, что произошло за столом.

// Рекордер отдаёт события только готовым пакетом — его и проверяем.
const finishMatch = (game: Game, message = 'Нечто проиграло'): IAnalyticsMatch => {
	const match = game.analytics.finish({game, endMessage: message, isComplete: true});
	if (!match) throw new Error('Рекордер не отдал партию');
	return match;
};

describe('Аналитика: запись партии', () => {
	it('пишет старт партии, рассадку и ходы', () => {
		const [, game] = createMockGameServer();
		const match = finishMatch(game);

		expect(match.matchId.length).toBeGreaterThan(10);
		expect(match.seed).toBe(game.seed);
		expect(match.source).toBe(EAnalyticsSource.test);
		expect(match.playerCount).toBe(6);
		expect(match.players.map((p) => p.seat)).toEqual([0, 1, 2, 3, 4, 5]);

		const start = match.events.filter((e) => e.type === EAnalyticsEvent.gameStart);
		expect(start.length).toBe(1);
		expect(String(start[0]?.detail.seats ?? '')).toContain('neerone');

		// Партия начинается сменой хода — значит первый ход уже записан.
		expect(match.events.some((e) => e.type === EAnalyticsEvent.turnStart)).toBe(true);
		expect(match.turns).toBeGreaterThan(0);
	});

	it('ровно один игрок помечен как Нечто', () => {
		const [, game] = createMockGameServer();
		const match = finishMatch(game);
		const things = match.players.filter((p) => p.isThing);
		expect(things.length).toBe(1);
		expect(things[0]?.role).toBe(EAnalyticsRole.thing);
		// Нечто заражено по определению.
		expect(things[0]?.infectedAtEnd).toBe(true);
	});

	it('запоминает статусы вместе с правдой на тот момент', () => {
		const [, game] = createMockGameServer();
		const marker = requirePlayer(game, game.playersList[0] ?? '');
		const target = requirePlayer(game, game.playersList[1] ?? '');
		target.isThing = false;
		target.isInfected = false;

		// clear -> question -> infected: три события подряд.
		marker.markPlayer(target.id);
		marker.markPlayer(target.id);
		marker.markPlayer(target.id);

		const match = finishMatch(game);
		const marks = match.events.filter((e) => e.type === EAnalyticsEvent.mark);
		expect(marks.length).toBe(3);
		expect(marks.map((e) => e.detail.mark)).toEqual([
			EAnalyticsMark.clear,
			EAnalyticsMark.question,
			EAnalyticsMark.infected,
		]);
		expect(marks[0]?.actor).toBe(marker.nickname);
		expect(marks[0]?.target).toBe(target.nickname);
		expect(marks[0]?.detail.previousMark).toBe(null);
		expect(marks[1]?.detail.previousMark).toBe(EPlayerMark.clear);
		// Цель на тот момент была чиста — значит «заражён» тут мимо.
		expect(marks[2]?.detail.targetWasInfected).toBe(false);
		expect(marks[2]?.detail.targetWasThing).toBe(false);
	});

	it('роль цели в статусе — та, что была в момент простановки', () => {
		const [, game] = createMockGameServer();
		const marker = requirePlayer(game, game.playersList[0] ?? '');
		const target = requirePlayer(game, game.playersList[1] ?? '');
		target.isInfected = false;
		marker.markPlayer(target.id);
		target.isInfected = true;
		marker.markPlayer(target.id);

		const marks = finishMatch(game).events.filter((e) => e.type === EAnalyticsEvent.mark);
		expect(marks[0]?.detail.targetWasInfected).toBe(false);
		expect(marks[1]?.detail.targetWasInfected).toBe(true);
	});

	it('пишет заражение с источником', () => {
		const [, game] = createMockGameServer();
		const source = requirePlayer(game, game.playersList[0] ?? '');
		const victim = requirePlayer(game, game.playersList[1] ?? '');
		victim.isInfected = false;
		game.infectPlayer(victim.id, {source, via: 'trade'});

		const infection = find(finishMatch(game).events, {type: EAnalyticsEvent.infection});
		expect(infection?.actor).toBe(source.nickname);
		expect(infection?.target).toBe(victim.nickname);
		expect(infection?.detail.via).toBe('trade');
		// Роль цели пишется ДО заражения — иначе момент заражения не отличить.
		expect(infection?.targetRole).toBe(EAnalyticsRole.human);
	});

	it('пишет смерть с причиной и тем, кто сжёг', () => {
		const [, game] = createMockGameServer();
		const killer = requirePlayer(game, game.playersList[0] ?? '');
		const victim = find(game.players, (p) => !p.isThing && p !== killer);
		if (!victim) throw new Error('Не нашли жертву');
		game.killPlayer(victim, {cause: EAnalyticsDeathCause.flamethrower, by: killer});

		const death = find(finishMatch(game).events, {type: EAnalyticsEvent.death});
		expect(death?.actor).toBe(killer.nickname);
		expect(death?.target).toBe(victim.nickname);
		expect(death?.detail.cause).toBe(EAnalyticsDeathCause.flamethrower);
		expect(death?.detail.victimWasThing).toBe(false);
	});

	it('пишет разыгранную карту и её цель одним событием', () => {
		const [, game] = createMockGameServer();
		const player = requirePlayer(game, game.turnPlayerId ?? '');
		const neighbourId = player.getPlayabeNeighbours()[0];
		if (!neighbourId) throw new Error('Нет доступного соседа');
		// Кладём «Анализ» в руку и играем его в соседа.
		const card = player.hand[0];
		if (!card) throw new Error('Пустая рука');
		card.id = EEventID.analysis;
		game.cardAction({player, actionType: EPlayerActionType.cardAct, cardUniqueId: card.uniqueId ?? ''});
		game.cardAction({player, actionType: EPlayerActionType.playerSelect, selectedPlayerId: neighbourId});

		const plays = finishMatch(game).events.filter(
			(e) => e.type === EAnalyticsEvent.cardPlay && e.cardId === EEventID.analysis,
		);
		expect(plays.length).toBe(1);
		expect(plays[0]?.actor).toBe(player.nickname);
		expect(plays[0]?.target).toBe(requirePlayer(game, neighbourId).nickname);
	});

	it('определяет победителя по финальному сообщению движка', () => {
		const [, gameA] = createMockGameServer();
		expect(finishMatch(gameA, 'Нечто победило').winner).toBe(EAnalyticsWinner.thing);
		const [, gameB] = createMockGameServer();
		expect(finishMatch(gameB, 'Нечто проиграло').winner).toBe(EAnalyticsWinner.humans);
	});

	it('победа стороны: заражённые выигрывают вместе с Нечто', () => {
		const [, game] = createMockGameServer();
		const infectedPlayer = find(game.players, (p) => !p.isThing);
		if (!infectedPlayer) throw new Error('Не нашли игрока');
		infectedPlayer.isInfected = true;

		const match = finishMatch(game, 'Нечто победило');
		const thing = match.players.find((p) => p.isThing);
		const infected = match.players.find((p) => p.nickname === infectedPlayer.nickname);
		const clean = match.players.find((p) => !p.isThing && !p.infectedAtEnd);
		expect(thing?.isWinner).toBe(true);
		expect(infected?.isWinner).toBe(true);
		expect(clean?.isWinner).toBe(false);
	});

	it('брошенная партия не даёт победителя', () => {
		const [, game] = createMockGameServer();
		const match = game.analytics.finish({game, endMessage: 'Партия не доиграна', isComplete: false});
		expect(match?.winner).toBe(null);
		expect(match?.isComplete).toBe(false);
		expect(match?.players.every((p) => !p.isWinner)).toBe(true);
	});

	it('одну партию нельзя отдать дважды', () => {
		const [, game] = createMockGameServer();
		expect(game.analytics.finish({game, endMessage: 'Нечто проиграло', isComplete: true})).not.toBe(null);
		expect(game.analytics.finish({game, endMessage: 'Нечто проиграло', isComplete: true})).toBe(null);
	});

	it('партии юнит-тестов не уезжают наружу', () => {
		const sent: IAnalyticsMatch[] = [];
		analyticsSink.onMatch = (match) => sent.push(match);
		try {
			const [, game] = createMockGameServer();
			game.end('Нечто проиграло');
			// Источник test отсеивается в submitMatch — до отправки дело не доходит.
			expect(sent.length).toBe(0);
		} finally {
			analyticsSink.onMatch = null;
		}
	});

	it('отправка включается только вместе с ANALYTICS_URL', () => {
		const previous = process.env.ANALYTICS_URL;
		try {
			delete process.env.ANALYTICS_URL;
			expect(analyticsSink.isEnabled()).toBe(false);
			process.env.ANALYTICS_URL = 'http://localhost:1';
			expect(analyticsSink.isEnabled()).toBe(true);
		} finally {
			if (previous === undefined) delete process.env.ANALYTICS_URL;
			else process.env.ANALYTICS_URL = previous;
		}
	});
});

describe('Аналитика: огнемёт', () => {
	// Огнемёт — единственная карта, у которой два исхода, и оба нужны статистике:
	// сожжение и спасение «Никаким шашлыком». У обоих событий должны стоять роли
	// обеих сторон — по ним считается, был ли выстрел ошибкой.
	const setupBurn = (game: Game) => {
		const shooter = requirePlayer(game, game.turnPlayerId ?? '');
		const victimId = shooter.getPlayabeNeighbours()[0];
		if (!victimId) throw new Error('Нет доступного соседа');
		const victim = requirePlayer(game, victimId);
		const card = shooter.hand[0];
		if (!card) throw new Error('Пустая рука');
		card.id = EEventID.flamethrower;
		game.cardAction({player: shooter, actionType: EPlayerActionType.cardAct, cardUniqueId: card.uniqueId ?? ''});
		game.cardAction({player: shooter, actionType: EPlayerActionType.playerSelect, selectedPlayerId: victimId});
		return {shooter, victim};
	};

	it('выстрел записан с ролями обеих сторон', () => {
		const [, game] = createMockGameServer();
		const {shooter, victim} = setupBurn(game);
		const attempt = find(finishMatch(game).events, {type: EAnalyticsEvent.cardPlay, cardId: EEventID.flamethrower});
		expect(attempt?.actor).toBe(shooter.nickname);
		expect(attempt?.target).toBe(victim.nickname);
		expect(attempt?.actorRole).not.toBe(null);
		expect(attempt?.targetRole).not.toBe(null);
	});

	it('спасение шашлыком — отдельное событие: спасшийся и тот, кто стрелял', () => {
		const [, game] = createMockGameServer();
		const {shooter, victim} = setupBurn(game);
		const noFire = victim.hand[0];
		if (!noFire) throw new Error('Пустая рука');
		noFire.id = EEventID.noFire;
		game.cardAction({player: victim, actionType: EPlayerActionType.actionDecision, action: 'noFire'});

		const match = finishMatch(game);
		const save = find(match.events, {type: EAnalyticsEvent.cardPlay, cardId: EEventID.noFire});
		expect(save?.actor).toBe(victim.nickname);
		expect(save?.target).toBe(shooter.nickname);
		// Спасшийся жив — значит смерти по огнемёту в партии нет.
		expect(find(match.events, {type: EAnalyticsEvent.death})).toBeUndefined();
	});

	it('сожжение записано с ролью стрелявшего и жертвы', () => {
		const [, game] = createMockGameServer();
		const {shooter, victim} = setupBurn(game);
		victim.isThing = false;
		victim.isInfected = false;
		game.cardAction({player: victim, actionType: EPlayerActionType.actionDecision, action: 'burn'});

		const death = find(finishMatch(game).events, {type: EAnalyticsEvent.death});
		expect(death?.actor).toBe(shooter.nickname);
		expect(death?.target).toBe(victim.nickname);
		expect(death?.detail.cause).toBe(EAnalyticsDeathCause.flamethrower);
		expect(death?.targetRole).toBe(EAnalyticsRole.human);
		expect(death?.actorRole).not.toBe(null);
	});
});
