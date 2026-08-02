import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame} from '../helpers/nechto';

// Паника «Давай дружить» (friendship): игрок выбирает ЛЮБОГО не-карантинного
// игрока и меняется с ним одной картой, после чего ход заканчивается. Паника
// достаётся из колоды через cardPick и в руку не попадает. Зеркалит
// friendshipTest.ts: playerSelect (контекст friendshipSeduction) -> обмен.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Давай дружить (friendship)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('обмен картой с выбранным игроком, затем ход заканчивается', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {
				Alice: ['seduction', 'miss', 'whiskey', 'barricade'],
				// Carol — не сосед, но друг дружить можно с любым.
				Carol: ['fear', 'noThanks', 'analysis', 'suspicion'],
			},
			deck: ['friendship'],
		});

		// Alice тянет карту -> попадается паника friendship.
		await session.cardPick('Alice');

		// В лог всем уходит строка «Alice достает карту паники ...».
		await session.waitFor('Bob', (s) =>
			s.gameLog.some((l) => l.includes('достает карту паники')),
		);

		// Alice получает выбор игрока (контекст friendshipSeduction): любой
		// не-карантинный игрок, кроме неё самой.
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const carolId = await session.idOf('Carol');
		const aliceId = await session.idOf('Alice');
		expect(offered).toContain(carolId);
		expect(offered).not.toContain(aliceId);

		// Alice выбирает Carol -> Alice переходит в offense-обмен именно с Carol.
		await session.selectPlayer('Alice', 'Carol');
		await session.expectTurnState('Alice', 'inOffenseTrade');

		// Alice предлагает miss; Carol просят отдать карту в ответ.
		await session.offerTrade('Alice', 'miss');
		await session.expectTurnState('Carol', 'inDefenseTrade');

		// Carol отдаёт fear. Обмен завершается.
		await session.offerTrade('Carol', 'fear');

		await session.waitFor('Alice', (s) => Object.values(s.hand).some((c) => c.id === 'fear'));
		const alice = await session.snapshot('Alice');
		// Alice получила fear, отдала miss, её ход завершён.
		expect(Object.values(alice.hand).map((c) => c.id)).toContain('fear');
		expect(Object.values(alice.hand).some((c) => c.id === 'miss')).toBe(false);
		expect(alice.players[alice.currentPlayerId!]?.turnState).toBe('idle');

		// Carol получила miss, отдала fear, и в реальной игре теперь тянет карту.
		const carol = await session.snapshot('Carol');
		expect(Object.values(carol.hand).map((c) => c.id)).toContain('miss');
		expect(Object.values(carol.hand).some((c) => c.id === 'fear')).toBe(false);

		// Ход переходит к следующему игроку (Bob) в фазу взятия карты.
		const bobId = await session.idOf('Bob');
		await session.waitFor('Bob', (s) => s.players[bobId]?.turnState === 'inCardPick');
	});
});
