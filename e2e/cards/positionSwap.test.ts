import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Меняемся местами (positionswap): "Поменяйтесь местами с соседним игроком,
// если он не на карантине и не за заколоченной дверью." The target may decline
// with "Мне и здесь неплохо" (leaveMeAlone).

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Меняемся местами (positionswap)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('меняется местами с соседом по согласию', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['positionswap']), Bob: fill([], 4)},
		});

		await session.play('Alice', 'positionswap');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const bobId = await session.idOf('Bob');
		expect(offered).toContain(bobId);

		const before = (await session.snapshot('Alice')).playersList;
		const aliceId = await session.idOf('Alice');

		// У Bob'а нет «Мне и здесь неплохо»: единственный вариант («Поменяться»)
		// сервер отыгрывает сам, ничего у Bob'а не спрашивая.
		await session.selectPlayer('Alice', 'Bob');
		await session.waitFor('Alice', (s) => s.playersList.indexOf(aliceId) === before.indexOf(bobId));
		expect((await session.snapshot('Bob')).currentAction?.type).toBeUndefined();
		const after = (await session.snapshot('Alice')).playersList;
		// Alice and Bob exchanged seats.
		expect(after.indexOf(aliceId)).toBe(before.indexOf(bobId));
		expect(after.indexOf(bobId)).toBe(before.indexOf(aliceId));
		await session.expectTurnState('Alice', 'inOffenseTrade');
	});

	test('сосед отказывается картой "Мне и здесь неплохо"', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['positionswap']), Bob: fill(['leaveMeAlone'], 4)},
			deck: ['analysis'],
		});

		await session.play('Alice', 'positionswap');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Bob');

		// Bob holds leaveMeAlone, so he may decline the swap.
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'actionDecision');
		const menu = (await session.snapshot('Bob')).currentAction?.menu ?? [];
		expect(menu.map((m) => m.action).sort()).toEqual(['cancelSwap', 'swap']);

		const before = (await session.snapshot('Alice')).playersList;
		const aliceId = await session.idOf('Alice');
		const bobId = await session.idOf('Bob');
		await session.decide('Bob', 'cancelSwap');

		// No swap happened; Bob's leaveMeAlone is discarded; Alice still trades.
		await session.expectTurnState('Alice', 'inOffenseTrade');
		const after = (await session.snapshot('Alice')).playersList;
		expect(after.indexOf(aliceId)).toBe(before.indexOf(aliceId));
		expect(after.indexOf(bobId)).toBe(before.indexOf(bobId));
		const bob = await session.snapshot('Bob');
		expect(Object.values(bob.hand).some((c) => c.id === 'leaveMeAlone')).toBe(false);
	});

	test('карантинного соседа выбрать нельзя', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['positionswap'])},
			quarantine: {Bob: 3},
		});

		await session.play('Alice', 'positionswap');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const bobId = await session.idOf('Bob');
		// Quarantined Bob is not a valid swap target; Erin (other neighbour) is.
		expect(offered).not.toContain(bobId);
		expect(offered).toContain(await session.idOf('Erin'));
	});
});
