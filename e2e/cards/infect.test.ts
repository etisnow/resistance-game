import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame} from '../helpers/nechto';

// Заражение (infect): "Получив эту карту от другого игрока вы становитесь
// заражённым и обязаны держать её на руке до конца игры." Mirrors the engine's
// trade-infect unit tests at browser fidelity: only the Thing may pass infect,
// and receiving it marks the player infected; an infected non-Thing can't drop
// their single infect card.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Заражение (infect)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('Нечто заражает соседа, передав карту заражения в обмене', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			things: ['Alice'],
			hands: {
				Alice: ['infect', 'analysis', 'suspicion', 'barricade', 'whiskey'],
				Bob: ['fear', 'miss', 'noThanks', 'seduction'],
			},
		});

		// Alice (the Thing) discards to start the trade with Bob, then passes infect.
		await session.discard('Alice', 'analysis');
		await session.expectTurnState('Alice', 'inOffenseTrade');
		await session.offerTrade('Alice', 'infect');
		await session.expectTurnState('Bob', 'inDefenseTrade');

		// Bob gives a card back; the swap delivers infect and infects him.
		await session.offerTrade('Bob', 'fear');

		await session.waitFor('Bob', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return !!me && me.isInfected === true;
		});
		const bob = await session.snapshot('Bob');
		const bobId = bob.currentPlayerId!;
		expect(bob.players[bobId]?.isInfected).toBe(true);
		// He now holds the infect card he must keep, and lost the card he gave.
		expect(Object.values(bob.hand).some((c) => c.id === 'infect')).toBe(true);
		expect(Object.values(bob.hand).some((c) => c.id === 'fear')).toBe(false);

		// Alice the Thing also sees Bob as infected.
		const alice = await session.snapshot('Alice');
		expect(alice.players[await session.idOf('Bob')]?.isInfected).toBe(true);
	});

	test('заражённый не-Нечто не может сбросить или сыграть единственную карту заражения', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Bob',
			infected: ['Bob'],
			hands: {Bob: ['infect', 'analysis', 'suspicion', 'barricade']},
		});

		// In the action phase, the infect card offers NO actions (no discard, no
		// act) — the player is bound to keep it.
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'turnCard');
		const snap = await session.snapshot('Bob');
		const infectUid = Object.values(snap.hand).find((c) => c.id === 'infect')?.uniqueId;
		expect(infectUid).toBeTruthy();
		expect(snap.handActions[infectUid!] ?? []).toEqual([]);
		// A normal card in the same hand still has its usual actions.
		const analysisUid = Object.values(snap.hand).find((c) => c.id === 'analysis')?.uniqueId;
		expect((snap.handActions[analysisUid!] ?? []).length).toBeGreaterThan(0);
	});
});
