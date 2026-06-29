import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Заколоченная дверь: "Поставьте 'Запертую дверь' между собой и соседним
// игроком." Played end to end in the browser. Mirrors barricadeTest.ts: a new
// 'Дверь' player is inserted into the playersList between the offense and the
// chosen neighbour. The list grows by one and the new id is a door player.
//
// Two engine branches:
//   * door against the NEXT neighbour -> the offense's next is now a door, so
//     the offense is blocked from trading and goes idle (turn passes onward).
//   * door against the PREVIOUS neighbour -> the offense still has a real next
//     player, so it proceeds into the offense trade.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Заколоченная дверь (barricade)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('ставит дверь между собой и следующим игроком, ход уходит дальше', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['barricade']),
				Bob: fill([], 4),
			},
		});

		const before = await session.snapshot('Alice');
		const beforeLen = before.playersList.length;
		expect(before.playersList.some((id) => before.players[id]?.state === 'door')).toBe(false);

		// Alice barricades against Bob (her next).
		await session.play('Alice', 'barricade');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const bobId = await session.idOf('Bob');
		const erinId = await session.idOf('Erin');
		// Only playable neighbours (next Bob, prev Erin) may be chosen.
		expect(offered.sort()).toEqual([bobId, erinId].sort());

		await session.selectPlayer('Alice', 'Bob');

		// The playersList grows by one and a new door player appears.
		await session.waitFor('Alice', (s) => s.playersList.length === beforeLen + 1);
		const snap = await session.snapshot('Alice');
		const doorId = snap.playersList.find((id) => snap.players[id]?.state === 'door');
		expect(doorId).toBeTruthy();
		// The door sits directly between Alice and Bob.
		const aliceIdx = snap.playersList.indexOf(snap.currentPlayerId!);
		expect(snap.playersList[aliceIdx + 1]).toBe(doorId);
		expect(snap.playersList[aliceIdx + 2]).toBe(bobId);

		// barricade is consumed.
		expect(Object.values(snap.hand).some((c) => c.id === 'barricade')).toBe(false);
		// Alice's next is now a door so she cannot trade; her turn ends (idle).
		await session.waitFor('Alice', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'idle';
		});
	});

	test('ставит дверь между собой и предыдущим игроком, переходит к обмену', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['barricade']),
				Erin: fill([], 4),
			},
		});

		const beforeLen = (await session.snapshot('Alice')).playersList.length;

		await session.play('Alice', 'barricade');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		// Alice barricades against Erin (her previous neighbour).
		await session.selectPlayer('Alice', 'Erin');

		await session.waitFor('Alice', (s) => s.playersList.length === beforeLen + 1);
		const snap = await session.snapshot('Alice');
		const doorId = snap.playersList.find((id) => snap.players[id]?.state === 'door');
		expect(doorId).toBeTruthy();
		// The door is inserted before Alice (between Erin and Alice).
		const erinId = await session.idOf('Erin');
		const aliceIdx = snap.playersList.indexOf(snap.currentPlayerId!);
		expect(snap.playersList[aliceIdx - 1] ?? snap.playersList[snap.playersList.length - 1]).toBe(doorId);
		expect(snap.players[erinId]?.state).not.toBe('door');

		// Alice still has a real next player, so she proceeds to the offense trade.
		await session.expectTurnState('Alice', 'inOffenseTrade');
	});

	test('карантинный сосед не предлагается как цель баррикады', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['barricade']),
				Bob: fill([], 4),
				Erin: fill([], 4),
			},
			quarantine: {Erin: 1},
		});

		await session.play('Alice', 'barricade');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const bobId = await session.idOf('Bob');
		const erinId = await session.idOf('Erin');
		expect(offered).toContain(bobId);
		// Quarantined neighbour Erin cannot be barricaded.
		expect(offered).not.toContain(erinId);
	});

	test('отмена возвращает карту баррикады в руку', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['barricade']),
				Bob: fill([], 4),
			},
		});

		const beforeLen = (await session.snapshot('Alice')).playersList.length;

		await session.play('Alice', 'barricade');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		expect((await session.snapshot('Alice')).isPlayerCanCancel).toBe(true);

		await session.cancel('Alice');
		await session.expectTurnState('Alice', 'inCardAction');
		const snap = await session.snapshot('Alice');
		// No door was inserted and barricade is back in hand.
		expect(snap.playersList.length).toBe(beforeLen);
		expect(Object.values(snap.hand).some((c) => c.id === 'barricade')).toBe(true);
	});
});
