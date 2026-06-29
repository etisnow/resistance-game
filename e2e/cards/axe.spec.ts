import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Топор: "Уберите 'Запертую дверь' или снимите 'Карантин' с себя или соседнего
// игрока." Played end to end in the browser. Mirrors axeTest.ts: axe breaks a
// door (built by a barricade) — that door player leaves the playersList — and
// axe lifts a quarantine (the target's quarantine drops to 0). Valid targets
// come from getAxeTargets: only quarantined / door neighbours, plus self when
// self-quarantined.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Топор (axe)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('снимает карантин с соседнего игрока', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['axe']),
				Bob: fill([], 4),
			},
			quarantine: {Bob: 3},
		});

		const bobId = await session.idOf('Bob');
		expect((await session.snapshot('Alice')).players[bobId]?.quarantine).toBe(3);

		// Only the quarantined neighbour Bob is an axe target.
		await session.play('Alice', 'axe');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		expect(offered).toContain(bobId);
		const erinId = await session.idOf('Erin');
		expect(offered).not.toContain(erinId);

		// Axe Bob: his quarantine drops to 0 and Alice moves to trade.
		await session.selectPlayer('Alice', 'Bob');
		await session.waitFor('Alice', (s) => s.players[bobId]?.quarantine === 0);
		const snap = await session.snapshot('Alice');
		expect(Object.values(snap.hand).some((c) => c.id === 'axe')).toBe(false);
		expect(snap.players[snap.currentPlayerId!]?.turnState).toBe('inOffenseTrade');
	});

	test('снимает карантин с самого себя', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['axe']),
				Bob: fill([], 4),
			},
			quarantine: {Alice: 2},
		});

		const aliceId = await session.idOf('Alice');
		await session.play('Alice', 'axe');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		// With no quarantined/door neighbours, only self is a valid target.
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		expect(offered).toContain(aliceId);

		await session.selectPlayer('Alice', 'Alice');
		await session.waitFor('Alice', (s) => s.players[aliceId]?.quarantine === 0);
		await session.expectTurnState('Alice', 'inOffenseTrade');
	});

	test('ломает дверь, поставленную баррикадой соседом', async () => {
		// Build a real door with a barricade, then axe it within one sequence.
		// Alice barricades against Bob (her next) -> a 'Дверь' player is inserted
		// between Alice and Bob. Alice's next is now the door, so her turn passes
		// (the door is skipped) to Bob in inCardPick. Bob holds axe: he draws,
		// then axes the door behind him (his previous neighbour), removing it.
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['barricade']),
				Bob: fill(['axe'], 4),
			},
			// A benign event on top so Bob's mandatory draw does not trigger a panic.
			deck: ['analysis'],
		});

		const beforeList = (await session.snapshot('Alice')).playersList;

		await session.play('Alice', 'barricade');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Bob');

		// The door now exists in the list, and the turn has moved on to Bob.
		await session.waitFor('Bob', (s) => s.playersList.length === beforeList.length + 1);
		let snap = await session.snapshot('Bob');
		const doorId = snap.playersList.find((id) => snap.players[id]?.state === 'door');
		expect(doorId).toBeTruthy();

		// Bob is the next-up player and must draw before acting (real game).
		await session.expectTurnState('Bob', 'inCardPick');
		await session.cardPick('Bob');
		await session.expectTurnState('Bob', 'inCardAction');

		// Bob axes the door: it is a valid axe target and disappears from the list.
		await session.play('Bob', 'axe');
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Bob')).currentAction?.playersToSelect ?? [];
		expect(offered).toContain(doorId);

		await session.selectId('Bob', doorId!);
		await session.waitFor('Bob', (s) => !s.playersList.includes(doorId!));
		snap = await session.snapshot('Bob');
		expect(snap.playersList.length).toBe(beforeList.length);
		expect(snap.players[snap.currentPlayerId!]?.turnState).toBe('inOffenseTrade');
	});
});
