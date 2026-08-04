import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from './helpers/nechto';

// Полная e2e игровая сессия в браузере: настоящий старт игры, поочерёдные ходы
// людей (взял карту → сыграл → обмен → ход переходит), прогон ВСЕХ карт событий
// и ВСЕХ карт паники, дисконнект и реконнект игрока посреди партии, и финал —
// победа одной из сторон. Всё гоняется через настоящий клиент/сокет/движок.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

// Все разыгрываемые карты событий и все карты паники (минус thing/infect,
// которые особые и покрыты отдельно — infect прогоняется ниже как обмен).
const PANICS = [
	'threeFour', 'chainReaction', 'blindDate', 'oldRopes', 'oneTwo',
	'onlyBetweenUs', 'youCallThisParty', 'goAway', 'oops', 'friendship', 'forgetfulness',
];

test.describe.serial('Полная игровая сессия', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	// ── 1. Поочередные ходы: каждый игрок берёт карту, играет/сбрасывает, меняется
	//      картой со следующим, ход переходит дальше — несколько кругов подряд.
	test('поочередный ход: игроки по очереди берут карту, играют и меняются', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {
				Alice: ['analysis', 'barricade', 'whiskey', 'seduction'],
				Bob: ['tenacity', 'analysis', 'barricade', 'whiskey'],
				Carol: ['seduction', 'tenacity', 'analysis', 'barricade'],
				Dave: ['whiskey', 'seduction', 'tenacity', 'analysis'],
				Erin: ['barricade', 'whiskey', 'seduction', 'tenacity'],
			},
			// Стопка для добора: Alice тянет suspicion (сыграет), Bob тянет панику
			// oldRopes (сработает сама), Carol тянет analysis (сыграет).
			deck: ['suspicion', 'oldRopes', 'analysis', 'tenacity', 'tenacity', 'tenacity'],
		});

		// Ход Alice: берёт suspicion, играет на соседа, затем меняется с Bob.
		await session.cardPick('Alice');
		await session.waitFor('Alice', (s) => Object.values(s.hand).some((c) => c.id === 'suspicion'));
		await session.play('Alice', 'suspicion');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Bob');
		// Подсмотренную карту закрывают руками — это и есть подтверждение осмотра,
		// после которого ход идёт к обмену.
		await session.waitFor('Alice', (s) => s.notifications.some((n) => n.type === 'okayCard'));
		await session.confirmCardsView('Alice');
		await session.expectTurnState('Alice', 'inOffenseTrade');
		await session.offerTrade('Alice', 'analysis');
		await session.expectTurnState('Bob', 'inDefenseTrade');
		await session.offerTrade('Bob', 'analysis');

		// Ход перешёл к Bob — он берёт карту, и это паника (срабатывает сразу).
		await session.expectTurnState('Bob', 'inCardPick');
		await session.cardPick('Bob');
		await session.waitFor('Bob', (s) => s.gameLog.some((l) => l.includes('достает карту паники')));
		// После паники oldRopes ходящий уходит в обмен; меняется с Carol.
		await session.expectTurnState('Bob', 'inOffenseTrade');
		await session.offerTrade('Bob', 'tenacity');
		await session.expectTurnState('Carol', 'inDefenseTrade');
		await session.offerTrade('Carol', 'tenacity');

		// Ход у Carol: берёт analysis, играет, меняется с Dave — ход уходит дальше.
		await session.expectTurnState('Carol', 'inCardPick');
		await session.cardPick('Carol');
		await session.waitFor('Carol', (s) => Object.values(s.hand).some((c) => c.id === 'analysis'));
		await session.play('Carol', 'analysis');
		await session.waitFor('Carol', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Carol', 'Dave');
		await session.waitFor('Carol', (s) => s.notifications.some((n) => n.type === 'okayCard'));
		await session.confirmCardsView('Carol');
		await session.expectTurnState('Carol', 'inOffenseTrade');
		await session.offerTrade('Carol', 'seduction');
		await session.expectTurnState('Dave', 'inDefenseTrade');
		await session.offerTrade('Dave', 'seduction');

		// Круг состоялся: ход дошёл до Dave.
		await session.expectTurnState('Dave', 'inCardPick');
	});

	// ── 2. Дисконнект и реконнект игрока во время партии.
	test('игрок отключается и переподключается, состояние восстанавливается', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['analysis']),
				Erin: ['fear', 'miss', 'noThanks', 'suspicion'],
			},
		});

		const erinId = await session.idOf('Erin');

		// Erin отключается — соседи видят её офлайн.
		await session.disconnect('Erin');
		expect((await session.snapshot('Alice')).players[erinId]?.isConnected).toBe(false);

		// Erin переподключается через лаунчер — снова онлайн и видит свою руку.
		await session.reconnect('Erin');
		await session.waitFor('Alice', (s) => s.players[erinId]?.isConnected === true);
		const erin = await session.snapshot('Erin');
		expect(Object.values(erin.hand).map((c) => c.id).sort()).toEqual(['fear', 'miss', 'noThanks', 'suspicion']);
		// Игра продолжается: ход всё ещё у Alice.
		const alice = await session.snapshot('Alice');
		expect(alice.players[await session.idOf('Alice')]?.turnState).toBe('inCardAction');
	});

	// ── 3. Прогон всех карт событий: каждая разыгрывается в живой партии, ход по
	//      очереди передаётся между игроками.
	test('прогон всех карт событий', async () => {
		// targeted-сосед: играем на соседа.
		const targetNeighbour = async (turn: string, card: string, target: string) => {
			await session.arrange({players: NICKS, turn, hands: {[turn]: fill([card]), [target]: fill([], 4)}});
			await session.play(turn, card);
			await session.waitFor(turn, (s) => s.currentAction?.type === 'playerSelect');
			await session.selectPlayer(turn, target);
		};

		// suspicion / analysis / barricade — навести на соседа. У подсмотра ход
		// ждёт, пока смотрящий не закроет окно с картами.
		await targetNeighbour('Alice', 'suspicion', 'Bob');
		await session.waitFor('Alice', (s) => s.notifications.some((n) => n.type === 'okayCard'));
		await session.confirmCardsView('Alice');
		await session.expectTurnState('Alice', 'inOffenseTrade');

		await targetNeighbour('Bob', 'analysis', 'Carol');
		await session.waitFor('Bob', (s) => s.notifications.some((n) => n.type === 'okayCard'));
		await session.confirmCardsView('Bob');
		await session.expectTurnState('Bob', 'inOffenseTrade');

		await targetNeighbour('Carol', 'barricade', 'Bob'); // дверь к предыдущему — можно меняться дальше
		await session.expectTurnState('Carol', 'inOffenseTrade');

		// positionswap + согласие соседа.
		await session.arrange({players: NICKS, turn: 'Dave', hands: {Dave: fill(['positionswap']), Erin: fill([], 4)}});
		await session.play('Dave', 'positionswap');
		await session.waitFor('Dave', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Dave', 'Erin');
		await session.waitFor('Erin', (s) => s.currentAction?.type === 'actionDecision');
		await session.decide('Erin', 'swap');
		await session.expectTurnState('Dave', 'inOffenseTrade');

		// reelFishingRods — на дальнего игрока + согласие.
		await session.arrange({players: NICKS, turn: 'Alice', hands: {Alice: fill(['reelFishingRods']), Carol: fill([], 4)}});
		await session.play('Alice', 'reelFishingRods');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Carol');
		await session.waitFor('Carol', (s) => s.currentAction?.type === 'actionDecision');
		await session.decide('Carol', 'swap');
		await session.expectTurnState('Alice', 'inOffenseTrade');

		// flamethrower — сосед спасается «Никакого шашлыка» (никто не гибнет).
		await session.arrange({
			players: NICKS, turn: 'Alice',
			hands: {Alice: fill(['flamethrower']), Bob: fill(['noFire'], 4)},
			deck: ['analysis', 'analysis'],
		});
		await session.play('Alice', 'flamethrower');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Bob');
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'actionDecision');
		await session.decide('Bob', 'noFire');
		await session.expectTurnState('Alice', 'inOffenseTrade');

		// axe — ломает карантин соседа.
		await session.arrange({players: NICKS, turn: 'Alice', hands: {Alice: fill(['axe'])}, quarantine: {Bob: 3}});
		await session.play('Alice', 'axe');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Bob');
		await session.waitFor('Alice', (s) => s.players[ (Object.values(s.players).find((p) => p.nickname === 'Bob')?.id) ?? '']?.quarantine === 0);

		// quarantine — на предыдущего соседа (Erin), Alice продолжает в обмен.
		await session.arrange({players: NICKS, turn: 'Alice', hands: {Alice: fill(['quarantine']), Erin: fill([], 4)}});
		await session.play('Alice', 'quarantine');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Erin');
		await session.expectTurnState('Alice', 'inOffenseTrade');

		// seduction — обмен с дальним игроком.
		await session.arrange({players: NICKS, turn: 'Bob', hands: {Bob: fill(['seduction']), Dave: fill([], 4)}});
		await session.play('Bob', 'seduction');
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Bob', 'Dave');
		await session.expectTurnState('Bob', 'inOffenseTrade');

		// tenacity — выбор одной из трёх.
		await session.arrange({players: NICKS, turn: 'Carol', hands: {Carol: fill(['tenacity'])}, deck: ['suspicion', 'analysis', 'barricade', 'whiskey']});
		await session.play('Carol', 'tenacity');
		await session.waitFor('Carol', (s) => s.currentAction?.type === 'selectCards');
		await session.selectNotificationCards('Carol', ['suspicion']);
		await session.expectTurnState('Carol', 'inCardAction');

		// lookaround / whiskey — без цели, сразу в обмен.
		await session.arrange({players: NICKS, turn: 'Dave', hands: {Dave: fill(['lookaround'])}});
		await session.play('Dave', 'lookaround');
		await session.expectTurnState('Dave', 'inOffenseTrade');

		await session.arrange({players: NICKS, turn: 'Erin', hands: {Erin: fill(['whiskey'])}});
		await session.play('Erin', 'whiskey');
		await session.expectTurnState('Erin', 'inOffenseTrade');

		// Защитные карты в обмене: fear / noThanks / miss + leaveMeAlone (анти-своп).
		// fear: Alice предлагает обмен Bob, Bob отказывается страхом.
		await session.arrange({players: NICKS, turn: 'Alice', hands: {Alice: ['analysis', 'barricade', 'whiskey', 'seduction'], Bob: ['fear', 'analysis', 'barricade', 'whiskey']}, deck: ['tenacity', 'tenacity']});
		await session.discard('Alice', 'analysis');
		await session.expectTurnState('Alice', 'inOffenseTrade');
		await session.offerTrade('Alice', 'barricade');
		await session.expectTurnState('Bob', 'inDefenseTrade');
		await session.play('Bob', 'fear');
		await session.waitFor('Bob', (s) => Object.values(s.hand).every((c) => c.id !== 'fear'));

		// noThanks
		await session.arrange({players: NICKS, turn: 'Alice', hands: {Alice: ['analysis', 'barricade', 'whiskey', 'seduction'], Bob: ['noThanks', 'analysis', 'barricade', 'whiskey']}, deck: ['tenacity', 'tenacity']});
		await session.discard('Alice', 'analysis');
		await session.offerTrade('Alice', 'barricade');
		await session.expectTurnState('Bob', 'inDefenseTrade');
		await session.play('Bob', 'noThanks');
		await session.waitFor('Bob', (s) => Object.values(s.hand).every((c) => c.id !== 'noThanks'));

		// miss — перенаправляет на следующего (Carol).
		await session.arrange({players: NICKS, turn: 'Alice', hands: {Alice: ['analysis', 'barricade', 'whiskey', 'seduction'], Bob: ['miss', 'analysis', 'barricade', 'whiskey']}, deck: ['tenacity', 'tenacity']});
		await session.discard('Alice', 'analysis');
		await session.offerTrade('Alice', 'barricade');
		await session.expectTurnState('Bob', 'inDefenseTrade');
		await session.play('Bob', 'miss');
		await session.expectTurnState('Carol', 'inDefenseTrade');

		// leaveMeAlone — отмена смены мест.
		await session.arrange({players: NICKS, turn: 'Alice', hands: {Alice: fill(['positionswap']), Bob: fill(['leaveMeAlone'], 4)}, deck: ['analysis']});
		await session.play('Alice', 'positionswap');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Bob');
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'actionDecision');
		await session.decide('Bob', 'cancelSwap');
		await session.expectTurnState('Alice', 'inOffenseTrade');

		// infect — Нечто заражает соседа (не последнего чистого, игра продолжается).
		await session.arrange({
			players: NICKS, turn: 'Alice', things: ['Alice'],
			hands: {Alice: ['infect', 'analysis', 'barricade', 'whiskey'], Bob: ['analysis', 'barricade', 'whiskey', 'seduction']},
		});
		await session.discard('Alice', 'analysis');
		await session.offerTrade('Alice', 'infect');
		await session.expectTurnState('Bob', 'inDefenseTrade');
		await session.offerTrade('Bob', 'analysis');
		const bobId = await session.idOf('Bob');
		await session.waitFor('Bob', (s) => s.players[bobId]?.isInfected === true);
	});

	// ── 4. Прогон всех карт паники: каждая тянется из колоды в живой партии.
	test('прогон всех карт паники', async () => {
		for (let i = 0; i < PANICS.length; i++) {
			const panic = PANICS[i]!;
			const turn = NICKS[i % NICKS.length]!;
			await session.arrange({
				players: NICKS,
				turn,
				turnState: 'inCardPick',
				hands: {[turn]: fill([], 4)},
				deck: [panic, 'analysis', 'analysis', 'analysis', 'suspicion', 'barricade'],
			});
			// Каждая паника объявляется всем новой строкой лога «достает карту паники»
			// (окна с картой больше нет — саму карту стол показывает в центре).
			const panicsBefore = (await session.snapshot(turn)).gameLog
				.filter((l) => l.includes('достает карту паники')).length;
			await session.cardPick(turn);
			await session.waitFor(turn, (s) =>
				s.gameLog.filter((l) => l.includes('достает карту паники')).length > panicsBefore,
			);

			// Разрешаем немедленный шаг выбора, если паника его требует.
			const after = await session.snapshot(turn);
			if (after.currentAction?.type === 'playerSelect') {
				const target = (after.currentAction.playersToSelect ?? [])[0];
				if (target) await session.selectId(turn, target);
			} else if (after.currentAction?.type === 'selectCards') {
				// Забывчивость: одно окно на весь обмен — отмечаем сколько просят и
				// подтверждаем разом.
				const count = after.currentAction.count ?? 0;
				const cardIds = Object.values(after.currentAction.cards ?? {}).slice(0, count).map((c) => c.id);
				if (cardIds.length === count) await session.selectNotificationCards(turn, cardIds);
			}
			// Сервер жив и игра идёт — состояние ходящего читается.
			const snap = await session.snapshot(turn);
			expect(snap.currentPlayerId).toBeTruthy();
		}
	});

	// ── 5. Финал сессии: Нечто заражает последнего чистого игрока — победа Нечто.
	test('сессия завершается победой одной из сторон', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			things: ['Alice'],
			infected: ['Carol', 'Dave', 'Erin'],
			hands: {
				Alice: ['infect', 'analysis', 'barricade', 'whiskey'],
				Bob: ['analysis', 'barricade', 'whiskey', 'seduction'],
			},
		});
		await session.discard('Alice', 'analysis');
		await session.offerTrade('Alice', 'infect');
		await session.expectTurnState('Bob', 'inDefenseTrade');
		await session.offerTrade('Bob', 'analysis');
		await session.waitFor('Bob', (s) => s.notifications.some((n) => n.type === 'gameEnd'));
		const end = (await session.snapshot('Bob')).notifications.find((n) => n.type === 'gameEnd');
		expect(end?.text).toContain('справился');
	});
});
