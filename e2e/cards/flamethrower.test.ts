import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Огнемёт: "Соседний игрок выбывает из игры." Played end to end in the browser
// — the offense plays the card, picks a neighbour, the neighbour decides to
// burn (or saves themselves with "Никакого шашлыка"), and the engine resolves.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Огнемёт (flamethrower)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('сжигает соседнего игрока — тот выбывает', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['flamethrower']),
				Bob: fill([], 4),
			},
		});

		// Alice plays flamethrower and is asked to pick a neighbour.
		await session.play('Alice', 'flamethrower');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const bobId = await session.idOf('Bob');
		expect(offered).toContain(bobId);

		// Alice targets Bob; Bob gets a burn decision.
		await session.selectPlayer('Alice', 'Bob');
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'actionDecision');
		const menu = (await session.snapshot('Bob')).currentAction?.menu ?? [];
		expect(menu.map((m) => m.action)).toEqual(['burn']);

		// Bob burns. He dies and leaves the players list; Alice moves to trade.
		await session.decide('Bob', 'burn');
		await session.waitFor('Bob', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'dead';
		});
		const after = await session.snapshot('Alice');
		expect(after.playersList).not.toContain(bobId);
		const aliceId = after.currentPlayerId!;
		expect(after.players[aliceId]?.turnState).toBe('inOffenseTrade');
		expect(after.gameLog.some((l) => l.includes('сожжен'))).toBe(true);
	});

	test('сосед спасается картой "Никакого шашлыка"', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['flamethrower']),
				Bob: fill(['noFire'], 4),
			},
			// Saving with noFire makes Bob draw a replacement; give the deck a card.
			deck: ['analysis', 'analysis'],
		});

		await session.play('Alice', 'flamethrower');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Bob');

		// Because Bob holds noFire, his decision menu offers the save.
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'actionDecision');
		const menu = (await session.snapshot('Bob')).currentAction?.menu ?? [];
		expect(menu.map((m) => m.action).sort()).toEqual(['burn', 'noFire']);

		await session.decide('Bob', 'noFire');

		// Bob survives, his noFire is gone, and he drew a replacement event card.
		await session.waitFor('Bob', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState !== 'dead' && Object.values(s.hand).every((c) => c.id !== 'noFire');
		});
		const bobId = await session.idOf('Bob');
		const alice = await session.snapshot('Alice');
		expect(alice.playersList).toContain(bobId);
		expect(alice.players[alice.currentPlayerId!]?.turnState).toBe('inOffenseTrade');
	});

	test('сжигание Нечто заканчивает игру — Нечто проигрывает', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['flamethrower']),
				Bob: fill([], 4),
			},
			things: ['Bob'],
		});

		await session.play('Alice', 'flamethrower');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Bob');
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'actionDecision');
		await session.decide('Bob', 'burn');

		// The game ends: every player gets the gameEnd notification, and its text
		// says the Thing failed ("не справился").
		await session.waitFor('Alice', (s) => s.notifications.some((n) => n.type === 'gameEnd'));
		const end = (await session.snapshot('Alice')).notifications.find((n) => n.type === 'gameEnd');
		expect(end?.text).toContain('не справился');
	});
});
