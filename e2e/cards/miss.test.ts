import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Мимо: защитная anti-trade карта. Жертва обмена отказывается, и вместо неё
// меняется СЛЕДУЮЩИЙ за ней игрок (он попадает в inDefenseTrade). Краевой
// случай: если следующим оказался бы сам offense-игрок — ничего не происходит
// и ход передаётся дальше.
// Mirrors src/_integration/__tests__/cardLogic/defenseCards/missTest.ts +
// src/server/helpers/cardActions/defense/miss.ts (getMissNextPlayer).

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Мимо (miss)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('перенаправляет обмен на следующего игрока', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: ['barricade', 'analysis', 'suspicion', 'tenacity', 'whiskey'],
				Bob: fill(['miss'], 4),
				Carol: fill([], 4),
			},
			deck: ['seduction', 'whiskey', 'suspicion'],
		});

		// Alice сбрасывает филлер -> входит в обмен с Bob.
		await session.discard('Alice', 'barricade');
		await session.expectTurnState('Alice', 'inOffenseTrade');

		// Alice предлагает analysis; Bob получает запрос на обмен.
		await session.offerTrade('Alice', 'analysis');
		await session.expectTurnState('Bob', 'inDefenseTrade');

		// Bob играет "Мимо" — отказывается, обмен переходит к Carol.
		await session.play('Bob', 'miss');

		// Carol теперь в inDefenseTrade; Bob и Alice — idle.
		await session.expectTurnState('Carol', 'inDefenseTrade');
		await session.waitFor('Bob', (s) => Object.values(s.hand).every((c) => c.id !== 'miss'));
		const bob = await session.snapshot('Bob');
		const bobId = bob.currentPlayerId!;
		expect(bob.players[bobId]?.turnState).toBe('idle');
		// Bob сбросил miss (-1) и вытянул карту события (+1): на руке снова 4.
		expect(Object.values(bob.hand)).toHaveLength(4);

		const alice = await session.snapshot('Alice');
		expect(alice.players[await session.idOf('Alice')]?.turnState).toBe('idle');
		// Предложенная карта всё ещё "в полёте": offense отдал её (рука 3),
		// analysis у Alice больше нет.
		expect(Object.values(alice.hand)).toHaveLength(3);
		expect(Object.values(alice.hand).some((c) => c.id === 'analysis')).toBe(false);

		// Carol завершает обмен, отдавая одну карту -> ход переходит к следующему
		// после offense игроку (Bob), который попадает в inCardPick.
		const carolCard = Object.values((await session.snapshot('Carol')).hand)[0]!;
		await session.offerTrade('Carol', carolCard.id);

		await session.waitFor('Bob', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'inCardPick';
		});
		// offense вернул себе руку из 4 карт (получил карту от Carol).
		const aliceAfter = await session.snapshot('Alice');
		expect(Object.values(aliceAfter.hand)).toHaveLength(4);
	});

	test('краевой случай: следующий — сам offense, ничего не происходит', async () => {
		// Только двое живых игроков: следующий после Bob (защита) — это Alice
		// (offense), поэтому getMissNextPlayer возвращает null: обмен прерывается.
		await session.arrange({
			players: ['Alice', 'Bob'],
			turn: 'Alice',
			hands: {
				Alice: ['barricade', 'analysis', 'suspicion', 'tenacity', 'whiskey'],
				Bob: fill(['miss'], 4),
			},
			deck: ['seduction', 'whiskey', 'suspicion'],
		});

		await session.discard('Alice', 'barricade');
		await session.expectTurnState('Alice', 'inOffenseTrade');
		await session.offerTrade('Alice', 'analysis');
		await session.expectTurnState('Bob', 'inDefenseTrade');

		await session.play('Bob', 'miss');

		// Ничего не перенаправляется: обмен прерван, ход передаётся дальше.
		// Offense (Alice) -> idle, его карта возвращена через прерывание (рука 4).
		await session.waitFor('Bob', (s) => Object.values(s.hand).every((c) => c.id !== 'miss'));
		const alice = await session.snapshot('Alice');
		const aliceId = await session.idOf('Alice');
		expect(alice.players[aliceId]?.turnState).toBe('idle');

		// Bob — единственный другой живой, становится ходящим (inCardPick),
		// вытянул карту события вместо обмена (4 -> 5).
		const bob = await session.snapshot('Bob');
		const bobId = bob.currentPlayerId!;
		expect(bob.players[bobId]?.turnState).toBe('inCardPick');
		// Bob сбросил miss (-1) и вытянул карту события (+1): на руке снова 4.
		expect(Object.values(bob.hand)).toHaveLength(4);
		// Никто не оказался в inDefenseTrade.
		expect(
			Object.values(bob.players).every((p) => p.turnState !== 'inDefenseTrade'),
		).toBe(true);
	});
});
