import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Страх: защитная anti-trade карта. Жертва обмена отказывается от него И
// подсматривает карту, которую ей предлагали; затем тянет карту события.
// Mirrors src/_integration/__tests__/cardLogic/defenseCards/fearTest.ts +
// src/server/helpers/cardActions/defense/fear.ts.
//
// Поток: Alice (offense) сбрасывает филлер -> inOffenseTrade с Bob; Alice
// предлагает analysis -> Bob попадает в inDefenseTrade с defenseTradeCard;
// Bob играет fear: отказывается, видит okayCard с предложенной картой,
// обмен Alice прерывается, Bob получает карту и ходит дальше.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Страх (fear)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('отказывается от обмена и подсматривает предложенную карту', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: ['barricade', 'analysis', 'suspicion', 'tenacity', 'whiskey'],
				Bob: fill(['fear'], 4),
			},
			deck: ['seduction', 'whiskey', 'suspicion'],
		});

		// Alice сбрасывает филлер -> входит в обмен с Bob.
		await session.discard('Alice', 'barricade');
		await session.expectTurnState('Alice', 'inOffenseTrade');

		// Alice предлагает analysis; Bob получает запрос на обмен (inDefenseTrade).
		await session.offerTrade('Alice', 'analysis');
		await session.expectTurnState('Bob', 'inDefenseTrade');
		const beforeBob = await session.snapshot('Bob');
		expect(beforeBob.currentAction?.type).toBe('defenseTradeCard');

		// Bob играет Страх (anti-trade cardAct).
		await session.play('Bob', 'fear');

		// Bob видит okayCard с картой, от обмена которой он отказался (analysis).
		await session.waitFor('Bob', (s) =>
			s.notifications.some(
				(n) =>
					n.type === 'okayCard' &&
					Object.values(n.cards ?? {}).some((c) => c.id === 'analysis'),
			),
		);

		// Страх ушёл из руки Bob, обмен Alice прерван: она возвращается в idle и
		// сохраняет свою analysis (обмен не состоялся). Bob становится ходящим
		// игроком, но в реальной игре — в фазе inCardPick (должен взять карту).
		await session.waitFor('Bob', (s) => Object.values(s.hand).every((c) => c.id !== 'fear'));
		const bob = await session.snapshot('Bob');
		const bobId = bob.currentPlayerId!;
		expect(bob.players[bobId]?.turnState).toBe('inCardPick');

		const alice = await session.snapshot('Alice');
		const aliceId = alice.currentPlayerId!;
		expect(alice.players[aliceId]?.turnState).toBe('idle');
		// Alice сохранила analysis — обмен не прошёл.
		expect(Object.values(alice.hand).some((c) => c.id === 'analysis')).toBe(true);
		expect(Object.values(alice.hand)).toHaveLength(4);

		// Bob сбросил Страх (-1) и вытянул карту события (+1): на руке снова 4.
		expect(Object.values(bob.hand)).toHaveLength(4);
		expect(alice.gameLog.some((l) => l.includes('Страх') && l.includes('отказывается'))).toBe(true);
	});
});
