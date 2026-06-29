import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Карантин: "Положите эту карту перед любым игроком (включая себя) рядом с
// собой. Этот игрок помещается на карантин." Played end to end in the browser:
// the offense plays the card, chooses a target among its neighbours or itself,
// and that target gets quarantine = 3. Mirrors quarantineTest.ts (self / next /
// prev) and the server action quarantine.ts.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Карантин (quarantine)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('применяется на себя — quarantine становится 3', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['quarantine'])},
		});

		await session.play('Alice', 'quarantine');

		// Alice is asked to pick a target: her neighbours (Bob, Erin) and herself.
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const aliceId = await session.idOf('Alice');
		const bobId = await session.idOf('Bob');
		const erinId = await session.idOf('Erin');
		const carolId = await session.idOf('Carol');
		expect(offered.sort()).toEqual([aliceId, bobId, erinId].sort());
		// A non-neighbour (Carol) is never offered.
		expect(offered).not.toContain(carolId);

		// Alice quarantines herself.
		await session.selectPlayer('Alice', 'Alice');

		await session.waitFor('Alice', (s) => s.players[aliceId]?.quarantine === 3);
		const snap = await session.snapshot('Alice');
		expect(snap.players[aliceId]?.quarantine).toBe(3);
		// quarantine card was discarded (hand back to 4) and the turn moves on to
		// the end-of-turn offense trade.
		expect(Object.values(snap.hand).some((c) => c.id === 'quarantine')).toBe(false);
		expect(Object.keys(snap.hand).length).toBe(4);
		// Having quarantined herself, Alice can't trade, so her turn simply ends
		// (she returns to idle and the next player must draw).
		expect(snap.players[snap.currentPlayerId!]?.turnState).toBe('idle');
		await session.expectTurnState('Bob', 'inCardPick');
	});

	test('применяется на следующего соседа (Bob) — обмен невозможен, ход кончается', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['quarantine']), Bob: fill([], 4)},
		});

		await session.play('Alice', 'quarantine');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Bob');

		const bobId = await session.idOf('Bob');
		await session.waitFor('Alice', (s) => s.players[bobId]?.quarantine === 3);
		const snap = await session.snapshot('Alice');
		expect(snap.players[bobId]?.quarantine).toBe(3);
		expect(snap.gameLog.some((l) => l.includes('карантин'))).toBe(true);
		// Bob is Alice's trade successor; having quarantined him she can't trade,
		// so her turn ends and Bob (still alive) becomes the next to draw.
		expect(snap.players[snap.currentPlayerId!]?.turnState).toBe('idle');
		await session.expectTurnState('Bob', 'inCardPick');
	});

	test('применяется на предыдущего соседа (Erin)', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['quarantine']), Erin: fill([], 4)},
		});

		await session.play('Alice', 'quarantine');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Erin');

		const erinId = await session.idOf('Erin');
		await session.waitFor('Alice', (s) => s.players[erinId]?.quarantine === 3);
		const snap = await session.snapshot('Alice');
		expect(snap.players[erinId]?.quarantine).toBe(3);
		expect(snap.players[snap.currentPlayerId!]?.turnState).toBe('inOffenseTrade');
	});

	test('сосед уже на карантине не предлагается в качестве цели', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['quarantine']), Bob: fill([], 4)},
			quarantine: {Bob: 3},
		});

		await session.play('Alice', 'quarantine');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const aliceId = await session.idOf('Alice');
		const bobId = await session.idOf('Bob');
		const erinId = await session.idOf('Erin');
		// Bob (already quarantined) is excluded; Alice and Erin remain offered.
		expect(offered).not.toContain(bobId);
		expect(offered.sort()).toEqual([aliceId, erinId].sort());
	});
});
