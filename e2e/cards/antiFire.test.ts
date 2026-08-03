import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Никакого шашлыка (noFire): защита от Огнемёта. Когда Огнемёт нацелен на
// игрока с картой noFire, меню решения предлагает 'noFire' (спастись) рядом с
// 'burn'. Выбор noFire спасает игрока, сбрасывает noFire, игрок тянет карту, а
// offense переходит в inOffenseTrade. Без noFire выбирать нечего — сервер
// сжигает сразу, окна решения у жертвы не появляется.
// Mirrors src/_integration/__tests__/cardLogic/defenseCards/antiFireTest.ts +
// src/server/helpers/cardActions/offense/flamethrower.ts.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Никакого шашлыка (noFire / antiFire)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('без noFire игрока не спрашивают — он сгорает сразу', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['flamethrower']),
				Bob: fill([], 4),
			},
		});

		await session.play('Alice', 'flamethrower');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Bob');

		await session.waitFor('Bob', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'dead';
		});
		expect((await session.snapshot('Bob')).currentAction?.type).toBeUndefined();
		await session.expectTurnState('Alice', 'inOffenseTrade');
	});

	test('с noFire меню предлагает "burn" и "noFire", выбор noFire спасает', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['flamethrower']),
				Bob: fill(['noFire'], 4),
			},
			deck: ['seduction', 'whiskey', 'suspicion'],
		});

		await session.play('Alice', 'flamethrower');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const bobId = await session.idOf('Bob');
		expect(offered).toContain(bobId);

		await session.selectPlayer('Alice', 'Bob');

		// Огнемёт нацелен — Alice ждёт решения (inCardActionProgress).
		await session.waitFor('Alice', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'inCardActionProgress';
		});

		// У Bob есть noFire -> меню предлагает обе опции.
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'actionDecision');
		const menu = (await session.snapshot('Bob')).currentAction?.menu ?? [];
		expect(menu.map((m) => m.action).sort()).toEqual(['burn', 'noFire']);

		// Bob выбирает noFire -> спасается, noFire уходит, тянет карту.
		await session.decide('Bob', 'noFire');

		await session.waitFor('Bob', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState !== 'dead' && Object.values(s.hand).every((c) => c.id !== 'noFire');
		});

		const bob = await session.snapshot('Bob');
		// Bob жив и остался в списке игроков.
		expect(bob.players[bobId]?.turnState).not.toBe('dead');
		// Bob сбросил noFire (-1) и вытянул замену (+1): на руке снова 4.
		expect(Object.values(bob.hand)).toHaveLength(4);

		// Alice (offense) переходит в обмен; Bob всё ещё в списке.
		const alice = await session.snapshot('Alice');
		expect(alice.playersList).toContain(bobId);
		expect(alice.players[alice.currentPlayerId!]?.turnState).toBe('inOffenseTrade');
	});

	test('держа noFire, игрок всё равно может выбрать "burn" и сгорает', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['flamethrower']),
				Bob: fill(['noFire'], 4),
			},
		});

		await session.play('Alice', 'flamethrower');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Bob');

		await session.waitFor('Bob', (s) => s.currentAction?.type === 'actionDecision');
		const menu = (await session.snapshot('Bob')).currentAction?.menu ?? [];
		expect(menu.map((m) => m.action).sort()).toEqual(['burn', 'noFire']);

		// Bob отказывается от спасения и сгорает.
		await session.decide('Bob', 'burn');

		await session.waitFor('Bob', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'dead';
		});

		const bobId = await session.idOf('Bob');
		const alice = await session.snapshot('Alice');
		// Bob выбыл из списка игроков; Alice переходит в обмен.
		expect(alice.playersList).not.toContain(bobId);
		expect(alice.players[alice.currentPlayerId!]?.turnState).toBe('inOffenseTrade');
		expect(alice.gameLog.some((l) => l.includes('сожжен'))).toBe(true);
	});
});
