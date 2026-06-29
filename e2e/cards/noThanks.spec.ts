import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Нет уж спасибо: защитная anti-trade карта. Жертва обмена просто отказывается
// от него и тянет карту события; обмен offense-игрока прерывается, остальные
// игроки получают okayCard о том, что игрок отказался.
// Mirrors src/_integration/__tests__/cardLogic/defenseCards/noThanksTest.ts +
// src/server/helpers/cardActions/defense/noThanks.ts.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Нет уж спасибо (noThanks)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('отказывается от обмена, обмен прерывается, остальные получают okayCard', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: ['barricade', 'analysis', 'suspicion', 'tenacity', 'whiskey'],
				Bob: fill(['noThanks'], 4),
			},
			deck: ['seduction', 'whiskey', 'suspicion'],
		});

		// Alice сбрасывает филлер -> входит в обмен с Bob.
		await session.discard('Alice', 'barricade');
		await session.expectTurnState('Alice', 'inOffenseTrade');

		// Alice предлагает analysis; Bob получает запрос на обмен.
		await session.offerTrade('Alice', 'analysis');
		await session.expectTurnState('Bob', 'inDefenseTrade');
		expect((await session.snapshot('Bob')).currentAction?.type).toBe('defenseTradeCard');

		// Bob играет "Нет уж спасибо".
		await session.play('Bob', 'noThanks');

		// Остальные игроки (Carol) получают okayCard с картой noThanks.
		await session.waitFor('Carol', (s) =>
			s.notifications.some(
				(n) =>
					n.type === 'okayCard' &&
					Object.values(n.cards ?? {}).some((c) => c.id === 'noThanks'),
			),
		);

		// noThanks ушёл из руки Bob; обмен Alice прерван (она сохранила analysis).
		await session.waitFor('Bob', (s) => Object.values(s.hand).every((c) => c.id !== 'noThanks'));
		const bob = await session.snapshot('Bob');
		const bobId = bob.currentPlayerId!;
		// Bob становится ходящим игроком, в реальной игре — в фазе inCardPick.
		expect(bob.players[bobId]?.turnState).toBe('inCardPick');
		// Bob сбросил noThanks (-1) и вытянул карту события (+1): на руке снова 4.
		expect(Object.values(bob.hand)).toHaveLength(4);

		const alice = await session.snapshot('Alice');
		const aliceId = alice.currentPlayerId!;
		expect(alice.players[aliceId]?.turnState).toBe('idle');
		// Обмен не состоялся — analysis остался у Alice.
		expect(Object.values(alice.hand).some((c) => c.id === 'analysis')).toBe(true);
		expect(Object.values(alice.hand)).toHaveLength(4);
	});
});
