import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Упорство: "Возьмите три карты событий, оставьте на руке одну и сбросьте
// остальные две. Затем сыграйте или сбросьте одну карту." Played end to end:
// the engine reveals the top three event cards, the player keeps one, and the
// other two are discarded.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Упорство (tenacity)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('показывает три карты, одна остаётся, две сбрасываются', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['tenacity'])},
			deck: ['suspicion', 'barricade', 'seduction', 'whiskey'],
		});

		await session.play('Alice', 'tenacity');

		// The three top event cards are offered for selection.
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'selectCard');
		const offered = (await session.snapshot('Alice')).currentAction?.cards ?? {};
		expect(Object.values(offered).map((c) => c.id).sort()).toEqual(['barricade', 'seduction', 'suspicion']);

		// Keep suspicion; tenacity itself is gone, suspicion joins the hand, the
		// player returns to the action phase with a card to play or discard.
		await session.selectNotificationCard('Alice', 'suspicion');
		await session.waitFor('Alice', (s) => Object.values(s.hand).some((c) => c.id === 'suspicion'));
		const snap = await session.snapshot('Alice');
		expect(Object.values(snap.hand).some((c) => c.id === 'tenacity')).toBe(false);
		expect(snap.players[snap.currentPlayerId!]?.turnState).toBe('inCardAction');
		// The two unchosen cards were discarded (barricade + seduction).
		expect(snap.deck.count).toBe(1);
	});
});
