import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Виски: "Покажите свои карты всем игрокам." Played end to end in the browser:
// the offense plays the card on themselves (non-targeted). Whiskey is discarded,
// then EVERY player receives an okayCard notification containing the offense's
// remaining hand, and the offense enters the end-of-turn trade. Mirrors
// whiskeyTest.ts and the server action whiskey.ts.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Виски (whiskey)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('показывает все свои карты всем игрокам', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: ['whiskey', 'fear', 'miss', 'noThanks', 'seduction'],
				Bob: fill([], 4),
			},
		});

		await session.play('Alice', 'whiskey');

		// whiskey is non-targeted: Alice does NOT enter a playerSelect step, she
		// goes straight to the offense trade once revealed.
		await session.expectTurnState('Alice', 'inOffenseTrade');

		// Alice's remaining hand after discarding whiskey.
		const remaining = ['fear', 'miss', 'noThanks', 'seduction'];
		const alice = await session.snapshot('Alice');
		expect(Object.values(alice.hand).some((c) => c.id === 'whiskey')).toBe(false);
		expect(Object.values(alice.hand).map((c) => c.id).sort()).toEqual([...remaining].sort());

		// A non-acting player (Bob) receives an okayCard revealing Alice's hand.
		await session.waitFor('Bob', (s) =>
			s.notifications.some(
				(n) => n.type === 'okayCard' && Object.keys(n.cards ?? {}).length === remaining.length,
			),
		);
		const bob = await session.snapshot('Bob');
		const reveal = bob.notifications.find(
			(n) => n.type === 'okayCard' && Object.keys(n.cards ?? {}).length === remaining.length,
		);
		expect(reveal).toBeTruthy();
		expect(Object.values(reveal!.cards ?? {}).map((c) => c.id).sort()).toEqual([...remaining].sort());

		// The reveal reaches another non-acting player too (Carol).
		await session.waitFor('Carol', (s) =>
			s.notifications.some(
				(n) => n.type === 'okayCard' && Object.keys(n.cards ?? {}).length === remaining.length,
			),
		);
	});
});
