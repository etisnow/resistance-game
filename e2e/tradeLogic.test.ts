import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame} from './helpers/nechto';

// The shared offense/defense trade mechanic most cards funnel into. After
// discarding (or playing) a card the turn player offers a card to the next
// player, who swaps one back. Mirrors the engine's trade unit tests, but at
// real browser fidelity: the next player ends in the explicit "draw a card"
// (inCardPick) phase the real game requires.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Обмен картами (trade)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('сброс запускает обмен, игроки меняются картами', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: ['analysis', 'suspicion', 'tenacity', 'barricade', 'whiskey'],
				Bob: ['fear', 'miss', 'noThanks', 'seduction'],
			},
		});

		// Alice discards a card -> she enters the offense trade with Bob.
		await session.discard('Alice', 'analysis');
		await session.expectTurnState('Alice', 'inOffenseTrade');

		// Alice offers suspicion; Bob is asked to pick a card to give back.
		await session.offerTrade('Alice', 'suspicion');
		await session.expectTurnState('Bob', 'inDefenseTrade');

		// Bob gives fear back. The swap completes.
		await session.offerTrade('Bob', 'fear');

		await session.waitFor('Alice', (s) => Object.values(s.hand).some((c) => c.id === 'fear'));
		const alice = await session.snapshot('Alice');
		expect(alice.players[alice.currentPlayerId!]?.turnState).toBe('idle');
		expect(Object.values(alice.hand).map((c) => c.id).sort()).toEqual(['barricade', 'fear', 'tenacity', 'whiskey']);
		expect(Object.values(alice.hand).some((c) => c.id === 'suspicion')).toBe(false);

		// Bob received suspicion, lost fear, and now must draw (real-game cardPick).
		const bob = await session.snapshot('Bob');
		expect(Object.values(bob.hand).some((c) => c.id === 'suspicion')).toBe(true);
		expect(Object.values(bob.hand).some((c) => c.id === 'fear')).toBe(false);
		expect(bob.players[bob.currentPlayerId!]?.turnState).toBe('inCardPick');
	});
});
