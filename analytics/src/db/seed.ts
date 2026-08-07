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
} from 'shared/analytics/contract';
import {EEventID, EPanicID} from 'shared/enum/cards';
import {getDb} from 'analytics/db/client';
import {ingestMatches} from 'analytics/db/ingest';

// Демо-данные: правдоподобные партии, чтобы витрину можно было смотреть до
// первой живой игры. Настоящие партии приезжают только из игрового сервера —
// этот скрипт лишь наполняет локальную базу для разработки.
//
// Запуск: bun run --cwd analytics seed  (переменная SEED_MATCHES задаёт число).

const NICKNAMES = ['Клык', 'Пилот', 'Док', 'Механик', 'Радист', 'Повар', 'Геолог', 'Норвежец'];
const TARGETED_CARDS = [
	EEventID.analysis,
	EEventID.suspicion,
	EEventID.flamethrower,
	EEventID.quarantine,
	EEventID.axe,
	EEventID.barricade,
	EEventID.seduction,
	EEventID.positionswap,
];
const SELF_CARDS = [EEventID.whiskey, EEventID.lookaround, EEventID.tenacity];
// recognitionTime закомментирован в колоде игры — в реальных партиях он не
// выпадает, и в демо-данных его быть не должно.
const PANICS = Object.values(EPanicID).filter((id) => id !== EPanicID.recognitionTime);

// Свой генератор псевдослучайных чисел: сид в аргументе -> одинаковый демо-набор
// у всех, кто запустит скрипт.
const mulberry32 = (seed: number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const generateMatch = (index: number, rng: () => number): IAnalyticsMatch => {
	const playerCount = 4 + Math.floor(rng() * 5);
	const table = [...NICKNAMES].sort(() => rng() - 0.5).slice(0, playerCount);
	const thing = table[Math.floor(rng() * table.length)] ?? table[0] ?? 'Клык';
	const infected = new Set<string>([thing]);
	const dead = new Set<string>();
	const startedAt = Math.floor(Date.now() - (index + 1) * 36e5 * (6 + rng() * 30));
	let ts = startedAt;
	let seq = 0;
	let turn = 0;
	const events: IAnalyticsEvent[] = [];
	const infectedAtTurn = new Map<string, number>();

	const roleOf = (nickname: string): EAnalyticsRole =>
		nickname === thing ? EAnalyticsRole.thing : infected.has(nickname) ? EAnalyticsRole.infected : EAnalyticsRole.human;

	const push = (event: Partial<IAnalyticsEvent> & {type: EAnalyticsEvent}) => {
		seq += 1;
		ts += 5_000 + Math.floor(rng() * 40_000);
		events.push({
			seq,
			ts,
			turn,
			actor: null,
			target: null,
			cardId: null,
			actorRole: event.actor ? roleOf(event.actor) : null,
			targetRole: event.target ? roleOf(event.target) : null,
			detail: {},
			...event,
		});
	};

	const alive = () => table.filter((nickname) => !dead.has(nickname));
	const pick = (pool: string[]) => pool[Math.floor(rng() * pool.length)] ?? pool[0] ?? thing;

	push({type: EAnalyticsEvent.gameStart, detail: {seed: index, playerCount, seats: table.join(', ')}});

	const turns = 20 + Math.floor(rng() * 40);
	for (let i = 0; i < turns; i++) {
		const living = alive();
		if (living.length <= 1) break;
		turn += 1;
		const actor = pick(living);
		push({type: EAnalyticsEvent.turnStart, actor});
		push({type: EAnalyticsEvent.cardDraw, actor, detail: {count: 1}});

		const roll = rng();
		if (roll < 0.12) {
			push({type: EAnalyticsEvent.panic, actor, cardId: pick(PANICS as unknown as string[])});
		} else if (roll < 0.5) {
			const others = living.filter((nickname) => nickname !== actor);
			const target = pick(others);
			const cardId = pick(TARGETED_CARDS as unknown as string[]);
			push({type: EAnalyticsEvent.cardPlay, actor, target, cardId});
			// У огнемёта два исхода, и статистике нужны оба: цель либо сгорает,
			// либо отбивается «Никаким шашлыком» (actor — спасшийся, target — тот,
			// кто стрелял).
			if (cardId === EEventID.flamethrower) {
				const roll2 = rng();
				if (roll2 < 0.25) {
					push({type: EAnalyticsEvent.cardPlay, actor: target, target: actor, cardId: EEventID.noFire});
				} else if (roll2 < 0.75) {
					push({
						type: EAnalyticsEvent.death,
						actor,
						target,
						detail: {
							cause: EAnalyticsDeathCause.flamethrower,
							victimWasThing: target === thing,
							victimWasInfected: infected.has(target),
						},
					});
					dead.add(target);
					if (target === thing) break;
				}
			}
		} else if (roll < 0.62) {
			push({type: EAnalyticsEvent.cardPlay, actor, cardId: pick(SELF_CARDS as unknown as string[])});
		} else if (roll < 0.75) {
			const others = living.filter((nickname) => nickname !== actor);
			const target = pick(others);
			push({type: EAnalyticsEvent.tradeOffer, actor, target, cardId: EEventID.infect});
			if (infected.has(actor) && !infected.has(target) && rng() < 0.4) {
				push({type: EAnalyticsEvent.infection, actor, target, cardId: EEventID.infect, detail: {via: 'trade'}});
				infected.add(target);
				infectedAtTurn.set(target, turn);
			} else {
				push({
					type: EAnalyticsEvent.tradeComplete,
					actor,
					target,
					cardId: EEventID.analysis,
					detail: {offenseCardId: EEventID.analysis, defenseCardId: EEventID.miss, infectPassed: false},
				});
			}
		} else {
			push({type: EAnalyticsEvent.cardDiscard, actor, cardId: pick(SELF_CARDS as unknown as string[])});
		}

		// Статусы: игроки лепят их постоянно, и правы бывают далеко не всегда.
		if (rng() < 0.55) {
			const marker = pick(living);
			const target = pick(living.filter((nickname) => nickname !== marker));
			const believesInfected = rng() < 0.45;
			const mark = believesInfected
				? rng() < 0.4
					? EAnalyticsMark.thing
					: EAnalyticsMark.infected
				: rng() < 0.6
					? EAnalyticsMark.clear
					: EAnalyticsMark.question;
			push({
				type: EAnalyticsEvent.mark,
				actor: marker,
				target,
				detail: {
					mark,
					previousMark: null,
					targetWasThing: target === thing,
					targetWasInfected: infected.has(target),
				},
			});
		}
	}

	const livingAtEnd = alive();
	const cleanLeft = livingAtEnd.filter((nickname) => !infected.has(nickname));
	// Партия кончается только двумя способами: Нечто сожгли — победили люди;
	// заражены все живые — победило Нечто. Демо-данные держим такими же
	// непротиворечивыми, как настоящие: иначе на витрине встретится «победа
	// Нечто» при полном столе чистых людей.
	const winner = dead.has(thing) ? EAnalyticsWinner.humans : EAnalyticsWinner.thing;
	if (winner === EAnalyticsWinner.thing) {
		for (const nickname of cleanLeft) {
			infected.add(nickname);
			infectedAtTurn.set(nickname, turn);
		}
	}
	const endMessage = winner === EAnalyticsWinner.thing ? 'Нечто победило' : 'Нечто проиграло';
	push({type: EAnalyticsEvent.gameEnd, detail: {winner, endMessage, isComplete: true}});

	return {
		matchId: `seed-${index}-${Math.floor(rng() * 1e9)}`,
		seed: index,
		source: EAnalyticsSource.live,
		startedAt,
		endedAt: ts,
		durationMs: ts - startedAt,
		playerCount,
		turns,
		winner,
		endReason: dead.has(thing) ? EAnalyticsEndReason.thingBurned : EAnalyticsEndReason.allInfected,
		endMessage,
		isComplete: true,
		hasBots: false,
		players: table.map((nickname, seat) => ({
			nickname,
			seat,
			isBot: false,
			isThing: nickname === thing,
			infectedAtEnd: infected.has(nickname),
			survived: !dead.has(nickname),
			isWinner: (infected.has(nickname) ? EAnalyticsWinner.thing : EAnalyticsWinner.humans) === winner,
			infectedAtTurn: infectedAtTurn.get(nickname) ?? null,
			role: roleOf(nickname),
		})),
		events,
		gameLog: [{text: `Сид игры: ${index}`, type: 'system'}, {text: endMessage, type: 'system'}],
	};
};

const total = Number(process.env.SEED_MATCHES) || 40;
const rng = mulberry32(Number(process.env.SEED_RANDOM) || 20260807);
const generated = Array.from({length: total}, (_, index) => generateMatch(index, rng));
const result = ingestMatches(getDb(), {version: ANALYTICS_CONTRACT_VERSION, matches: generated});
console.log(`[seed] сгенерировано ${total}, принято ${result.accepted}, дублей ${result.duplicates}`);
if (result.errors) console.error(result.errors);
