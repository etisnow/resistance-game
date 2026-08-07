import {
	ANALYTICS_CONTRACT_VERSION,
	EAnalyticsDeathCause,
	EAnalyticsEndReason,
	EAnalyticsEvent,
	EAnalyticsMark,
	EAnalyticsRole,
	EAnalyticsSource,
	EAnalyticsWinner,
	type IAnalyticsEvent,
	type IAnalyticsMatch,
	type IAnalyticsMatchPlayer,
	type TAnalyticsDetail,
} from 'shared/analytics/contract';
import type {Game} from 'server/models/Game';
import type {Player} from 'server/models/Player';
import {gameServer} from 'server/server/GameServer';

// Потолок событий на партию. Обычная партия — сотни событий; лимит нужен только
// чтобы зависший бот-цикл не съел память сервера. При переполнении пишем хвост
// (последние события интереснее первых для разбора «чем кончилось»).
const MAX_EVENTS = 4000;

/**
 * Запись одной партии. Живёт внутри `Game`, копит события в памяти и отдаёт
 * готовый пакет ровно один раз — в конце партии. Наружу по ходу игры не уходит
 * ничего: иначе публичная статистика показывала бы, кто Нечто, прямо во время
 * игры.
 *
 * Все методы безопасны: любая ошибка внутри проглатывается — аналитика не имеет
 * права уронить игру.
 */
export class MatchRecorder {
	readonly matchId: string;
	private events: IAnalyticsEvent[] = [];
	private seq = 0;
	private turn = 0;
	private startedAt = 0;
	private dropped = 0;
	private finished = false;
	// Ход, на котором игрок заразился — считаем по первому событию infection.
	private infectedAtTurn: Map<string, number> = new Map();
	// Ники в порядке рассадки на момент старта (playersList потом редеет).
	private seats: string[] = [];

	constructor(matchId: string) {
		this.matchId = matchId;
	}

	// ---------------------------------------------------------------- helpers

	private role(player: Player | null | undefined): EAnalyticsRole | null {
		if (!player) return null;
		if (player.isThing) return EAnalyticsRole.thing;
		if (player.isInfected) return EAnalyticsRole.infected;
		return EAnalyticsRole.human;
	}

	private push({
		type,
		actor = null,
		target = null,
		cardId = null,
		detail = {},
	}: {
		type: EAnalyticsEvent;
		actor?: Player | null;
		target?: Player | null;
		cardId?: string | null;
		detail?: TAnalyticsDetail;
	}) {
		try {
			if (this.finished) return;
			if (this.events.length >= MAX_EVENTS) {
				this.dropped += 1;
				this.events.shift();
			}
			this.seq += 1;
			this.events.push({
				seq: this.seq,
				ts: Date.now(),
				turn: this.turn,
				type,
				actor: actor ? actor.nickname : null,
				target: target ? target.nickname : null,
				cardId,
				actorRole: this.role(actor),
				targetRole: this.role(target),
				detail,
			});
		} catch {
			// Аналитика молчит и не мешает игре.
		}
	}

	// ------------------------------------------------------------ жизнь партии

	gameStart(game: Game) {
		this.startedAt = Date.now();
		this.seats = game.playersList
			.map((id) => game.players[id])
			.filter((p): p is Player => !!p)
			.map((p) => p.nickname);
		this.push({
			type: EAnalyticsEvent.gameStart,
			detail: {
				seed: game.seed,
				playerCount: this.seats.length,
				seats: this.seats.join(', '),
			},
		});
	}

	turnStart(player: Player) {
		this.turn += 1;
		this.push({type: EAnalyticsEvent.turnStart, actor: player});
	}

	// ------------------------------------------------------------------ карты

	cardDraw(player: Player, count = 1) {
		this.push({type: EAnalyticsEvent.cardDraw, actor: player, detail: {count}});
	}

	/**
	 * Карта разыграна. Цель на этот момент чаще всего ещё не выбрана — её
	 * доклеивает `cardPlayTarget`, когда игрок ткнёт в соседа.
	 */
	cardPlay(player: Player, cardId: string, target?: Player | null) {
		this.push({type: EAnalyticsEvent.cardPlay, actor: player, target: target ?? null, cardId});
	}

	/**
	 * Цель прицельной карты. Ищем последнее собственное `card_play` этой же
	 * картой без цели и дописываем её туда — так одна разыгранная карта остаётся
	 * одним событием. Если такого нет (паника, восстановление после реконнекта) —
	 * заводим отдельное событие.
	 */
	cardPlayTarget(player: Player, cardId: string, target: Player) {
		try {
			for (let i = this.events.length - 1; i >= 0; i--) {
				const event = this.events[i];
				if (!event) continue;
				if (event.type !== EAnalyticsEvent.cardPlay) continue;
				if (event.actor !== player.nickname || event.cardId !== cardId) continue;
				if (event.target) break;
				event.target = target.nickname;
				event.targetRole = this.role(target);
				return;
			}
		} catch {
			// Падать нельзя — просто запишем цель отдельным событием ниже.
		}
		this.cardPlay(player, cardId, target);
	}

	cardDiscard(player: Player, cardId: string) {
		this.push({type: EAnalyticsEvent.cardDiscard, actor: player, cardId});
	}

	// ------------------------------------------------------------------ обмены

	tradeOffer(from: Player, to: Player, cardId: string) {
		this.push({type: EAnalyticsEvent.tradeOffer, actor: from, target: to, cardId});
	}

	tradeComplete({
		offense,
		defense,
		offenseCardId,
		defenseCardId,
	}: {
		offense: Player;
		defense: Player;
		offenseCardId: string;
		defenseCardId: string;
	}) {
		this.push({
			type: EAnalyticsEvent.tradeComplete,
			actor: offense,
			target: defense,
			cardId: offenseCardId,
			detail: {
				offenseCardId,
				defenseCardId,
				// Обмен, в котором «Заражение!» сменило хозяина — самая важная
				// разновидность обмена для разбора партии.
				infectPassed: offenseCardId === 'infect' || defenseCardId === 'infect',
			},
		});
	}

	tradeRefuse(player: Player, target: Player, cardId: string) {
		this.push({type: EAnalyticsEvent.tradeRefuse, actor: player, target, cardId});
	}

	// -------------------------------------------------------- ключевые события

	panic(player: Player, panicId: string) {
		this.push({type: EAnalyticsEvent.panic, actor: player, cardId: panicId});
	}

	infection({target, source, via}: {target: Player; source?: Player | null; via: string}) {
		if (!this.infectedAtTurn.has(target.nickname)) {
			this.infectedAtTurn.set(target.nickname, this.turn);
		}
		this.push({
			type: EAnalyticsEvent.infection,
			actor: source ?? null,
			target,
			cardId: 'infect',
			detail: {via},
		});
	}

	death({player, cause, by}: {player: Player; cause: EAnalyticsDeathCause; by?: Player | null}) {
		this.push({
			type: EAnalyticsEvent.death,
			actor: by ?? null,
			target: player,
			detail: {
				cause,
				// Сожгли ли Нечто — по этому полю считается «кто закончил партию».
				victimWasThing: player.isThing,
				victimWasInfected: player.isInfected,
			},
		});
	}

	quarantine({actor, target, turns}: {actor: Player; target: Player; turns: number}) {
		this.push({
			type: EAnalyticsEvent.quarantine,
			actor,
			target,
			cardId: 'quarantine',
			detail: {turns, isSelf: actor.nickname === target.nickname},
		});
	}

	/**
	 * Игрок повесил статус на другого игрока. Роли пишутся снимком на этот
	 * момент — правоту считаем по тому, что было правдой, когда статус ставили,
	 * а не по тому, что стало потом.
	 */
	mark({
		actor,
		target,
		mark,
		previousMark,
	}: {
		actor: Player;
		target: Player;
		mark: EAnalyticsMark;
		previousMark: EAnalyticsMark | null;
	}) {
		this.push({
			type: EAnalyticsEvent.mark,
			actor,
			target,
			detail: {
				mark,
				previousMark: previousMark ?? null,
				targetWasThing: target.isThing,
				targetWasInfected: target.isInfected,
			},
		});
	}

	decision({player, action, cardId}: {player: Player; action: string; cardId?: string | null}) {
		this.push({
			type: EAnalyticsEvent.decision,
			actor: player,
			cardId: cardId ?? null,
			detail: {action},
		});
	}

	// ------------------------------------------------------------ конец партии

	/**
	 * Собрать пакет партии. Вызывается один раз: повторный вызов вернёт null,
	 * чтобы одна партия не уехала в аналитику дважды.
	 */
	finish({game, endMessage, isComplete}: {game: Game; endMessage: string; isComplete: boolean}): IAnalyticsMatch | null {
		try {
			if (this.finished) return null;
			this.finished = true;
			const endedAt = Date.now();
			const startedAt = this.startedAt || endedAt;
			// Партия не начиналась (комнату закрыли в лобби) — отправлять нечего.
			if (!this.startedAt || this.seats.length === 0) return null;

			const winner = resolveWinner(endMessage, isComplete);
			const players = this.collectPlayers(game, winner);
			this.push({
				type: EAnalyticsEvent.gameEnd,
				detail: {winner: winner ?? 'none', endMessage, isComplete},
			});

			return {
				matchId: this.matchId,
				seed: game.seed,
				source: resolveSource(game),
				startedAt,
				endedAt,
				durationMs: endedAt - startedAt,
				playerCount: players.length,
				turns: this.turn,
				winner,
				endReason: resolveEndReason(endMessage, isComplete),
				endMessage,
				isComplete,
				hasBots: players.some((p) => p.isBot),
				players,
				events: this.events,
				gameLog: game.gameLog.map((line) => ({text: line.text, type: String(line.type)})),
			};
		} catch (e) {
			console.error('[analytics] не удалось собрать партию:', e);
			return null;
		}
	}

	private collectPlayers(game: Game, winner: EAnalyticsWinner | null): IAnalyticsMatchPlayer[] {
		// Идём по рассадке на старте: playersList к концу партии уже без мертвецов,
		// а в статистике нужны все, кто сел за стол.
		return this.seats.map((nickname, seat) => {
			const player = findPlayerByNickname(game, nickname);
			const isThing = !!player?.isThing;
			const infectedAtEnd = !!player?.isInfected;
			const survived = !!player?.isAlive();
			const role = isThing
				? EAnalyticsRole.thing
				: infectedAtEnd
					? EAnalyticsRole.infected
					: EAnalyticsRole.human;
			// Заражённый человек играет за Нечто: его победа — победа Нечто.
			const side = infectedAtEnd ? EAnalyticsWinner.thing : EAnalyticsWinner.humans;
			return {
				nickname,
				seat,
				isBot: !!player?.isBot,
				isThing,
				infectedAtEnd,
				survived,
				isWinner: winner !== null && winner === side,
				infectedAtTurn: isThing ? null : (this.infectedAtTurn.get(nickname) ?? null),
				role,
			};
		});
	}
}

const findPlayerByNickname = (game: Game, nickname: string): Player | undefined =>
	Object.values(game.players).find((p) => p.nickname === nickname);

// Движок сообщает исход одной строкой — она же уходит в игровой лог.
const resolveWinner = (endMessage: string, isComplete: boolean): EAnalyticsWinner | null => {
	if (!isComplete) return null;
	if (endMessage.includes('Нечто победило')) return EAnalyticsWinner.thing;
	if (endMessage.includes('Нечто проиграло')) return EAnalyticsWinner.humans;
	return null;
};

const resolveEndReason = (endMessage: string, isComplete: boolean): EAnalyticsEndReason => {
	if (!isComplete) return EAnalyticsEndReason.abandoned;
	if (endMessage.includes('Нечто победило')) return EAnalyticsEndReason.allInfected;
	if (endMessage.includes('Нечто проиграло')) return EAnalyticsEndReason.thingBurned;
	return EAnalyticsEndReason.other;
};

// Живые партии, дев-режим с ботами, e2e и юнит-тесты попадают в одну базу, но
// разделяются источником: публичная витрина показывает только `live`.
// gameServer читается лениво (внутри функции) — на уровне модуля это замкнуло бы
// круг импортов Game -> recorder -> GameServer -> Game.
const resolveSource = (game: Game): EAnalyticsSource => {
	if (gameServer.analyticsSource) return gameServer.analyticsSource;
	if (gameServer.isMock) return EAnalyticsSource.test;
	if (process.env.NECHTO_E2E === 'true') return EAnalyticsSource.e2e;
	if (Object.values(game.players).some((p) => p.isBot)) return EAnalyticsSource.bots;
	return EAnalyticsSource.live;
};

export const analyticsContractVersion = ANALYTICS_CONTRACT_VERSION;
