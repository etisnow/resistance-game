import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Мне и здесь неплохо (leaveMeAlone) — защита от карт смены мест. Эта спека
// зеркалит swapTest.ts (defenseCards), фокусируясь на стороне ЗАЩИТЫ: когда у
// цели есть leaveMeAlone, меню предлагает swap/cancelSwap. swapTest проверяет
// три ветки:
//   1. positionswap + cancelSwap -> позиции не меняются, leaveMeAlone сброшен;
//   2. reelFishingRods (удочки) + cancelSwap -> то же, через другую offense-карту;
//   3. positionswap + swap -> игрок соглашается, позиции меняются, leaveMeAlone
//      ОСТАЁТСЯ в руке (не был использован).
// (Базовые ветки positionswap/reelFishingRods со swap покрыты в
// positionSwap.spec.ts / reelFishingRods.spec.ts.)
// Oracle: src/_integration/__tests__/cardLogic/defenseCards/swapTest.ts +
// src/server/helpers/cardActions/offense/positionswap.ts (positionswapFinish).

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Мне и здесь неплохо (leaveMeAlone / anti-swap)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('positionswap + cancelSwap: позиции не меняются, leaveMeAlone сброшен', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['positionswap']),
				Bob: fill(['leaveMeAlone'], 4),
			},
			deck: ['seduction', 'whiskey', 'suspicion'],
		});

		const aliceId = await session.idOf('Alice');
		const bobId = await session.idOf('Bob');
		const before = await session.snapshot('Alice');
		const alicePos0 = before.playersList.indexOf(aliceId);
		const bobPos0 = before.playersList.indexOf(bobId);

		await session.play('Alice', 'positionswap');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Bob');

		// У Bob есть leaveMeAlone -> меню предлагает swap и cancelSwap.
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'actionDecision');
		const menu = (await session.snapshot('Bob')).currentAction?.menu ?? [];
		expect(menu.map((m) => m.action).sort()).toEqual(['cancelSwap', 'swap']);

		await session.decide('Bob', 'cancelSwap');

		// Позиции не изменились; Bob сбросил leaveMeAlone и вытянул замену;
		// Alice всё равно переходит в inOffenseTrade.
		await session.waitFor('Alice', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'inOffenseTrade';
		});
		const after = await session.snapshot('Alice');
		expect(after.playersList.indexOf(aliceId)).toBe(alicePos0);
		expect(after.playersList.indexOf(bobId)).toBe(bobPos0);

		const bob = await session.snapshot('Bob');
		expect(Object.values(bob.hand).every((c) => c.id !== 'leaveMeAlone')).toBe(true);
		// Сбросил leaveMeAlone (-1) и вытянул карту (+1): снова 4.
		expect(Object.values(bob.hand)).toHaveLength(4);
	});

	test('удочки (reelFishingRods) + cancelSwap: позиции не меняются', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['reelFishingRods']),
				Dave: fill(['leaveMeAlone'], 4),
			},
			deck: ['seduction', 'whiskey', 'suspicion'],
		});

		const aliceId = await session.idOf('Alice');
		const daveId = await session.idOf('Dave');
		const before = await session.snapshot('Alice');
		const alicePos0 = before.playersList.indexOf(aliceId);
		const davePos0 = before.playersList.indexOf(daveId);

		await session.play('Alice', 'reelFishingRods');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		// Удочки позволяют выбрать не-соседа Dave.
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		expect(offered).toContain(daveId);
		await session.selectPlayer('Alice', 'Dave');

		await session.waitFor('Dave', (s) => s.currentAction?.type === 'actionDecision');
		const menu = (await session.snapshot('Dave')).currentAction?.menu ?? [];
		expect(menu.map((m) => m.action).sort()).toEqual(['cancelSwap', 'swap']);

		await session.decide('Dave', 'cancelSwap');

		await session.waitFor('Alice', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'inOffenseTrade';
		});
		const after = await session.snapshot('Alice');
		// Позиции не изменились (отказ).
		expect(after.playersList.indexOf(aliceId)).toBe(alicePos0);
		expect(after.playersList.indexOf(daveId)).toBe(davePos0);

		const dave = await session.snapshot('Dave');
		expect(Object.values(dave.hand).every((c) => c.id !== 'leaveMeAlone')).toBe(true);
	});

	test('positionswap + swap: соглашается, меняется местами, leaveMeAlone остаётся', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['positionswap']),
				Bob: fill(['leaveMeAlone'], 4),
			},
		});

		const aliceId = await session.idOf('Alice');
		const bobId = await session.idOf('Bob');
		const before = await session.snapshot('Alice');
		const alicePos0 = before.playersList.indexOf(aliceId);
		const bobPos0 = before.playersList.indexOf(bobId);

		await session.play('Alice', 'positionswap');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Bob');

		await session.waitFor('Bob', (s) => s.currentAction?.type === 'actionDecision');
		const menu = (await session.snapshot('Bob')).currentAction?.menu ?? [];
		expect(menu.map((m) => m.action).sort()).toEqual(['cancelSwap', 'swap']);

		// Несмотря на наличие leaveMeAlone, Bob соглашается на обмен.
		await session.decide('Bob', 'swap');

		// Позиции меняются; leaveMeAlone НЕ был использован — остаётся в руке.
		await session.waitFor('Alice', (s) => s.playersList.indexOf(aliceId) === bobPos0);
		const after = await session.snapshot('Alice');
		expect(after.playersList.indexOf(aliceId)).toBe(bobPos0);
		expect(after.playersList.indexOf(bobId)).toBe(alicePos0);
		expect(after.players[aliceId]?.turnState).toBe('inOffenseTrade');

		const bob = await session.snapshot('Bob');
		expect(Object.values(bob.hand).some((c) => c.id === 'leaveMeAlone')).toBe(true);
		expect(Object.values(bob.hand)).toHaveLength(4);
	});
});
