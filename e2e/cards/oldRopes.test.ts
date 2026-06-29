import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Паника "Старые верёвки" (oldRopes): ВСЕ разыгранные карты "Карантин"
// сбрасываются — у каждого игрока quarantine обнуляется. Паника не лежит в руке —
// её ТЯНУТ: ход в фазе inCardPick, паника сверху колоды, игрок берёт карту и
// эффект срабатывает мгновенно (без playerSelect), после чего игрок уходит в
// offense trade. Зеркалит oldRopesTest.ts и серверный экшен oldRopes.ts.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Старые верёвки (oldRopes)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('сбрасывает все карантины: у всех игроков карантин обнуляется', async () => {
		// Несколько игроков на карантине; Alice тянет oldRopes.
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {Alice: fill([], 4)},
			deck: ['oldRopes', 'analysis', 'analysis', 'analysis'],
			quarantine: {Bob: 3, Carol: 2, Dave: 1},
		});

		const aliceId = await session.idOf('Alice');
		const bobId = await session.idOf('Bob');
		const carolId = await session.idOf('Carol');
		const daveId = await session.idOf('Dave');

		// До паники карантины расставлены (смотрим из вью Alice).
		const before = await session.snapshot('Alice');
		expect(before.players[bobId]?.quarantine).toBe(3);
		expect(before.players[carolId]?.quarantine).toBe(2);
		expect(before.players[daveId]?.quarantine).toBe(1);

		// Alice тянет карту — срабатывает паника.
		await session.cardPick('Alice');

		// Всем пришёл okayCard "Alice достает карту паники".
		await session.waitFor('Alice', (s) =>
			s.notifications.some((n) => n.type === 'okayCard' && (n.text ?? '').includes('достает карту паники')),
		);

		// Эффект мгновенный: все карантины обнулены, Alice уходит в offense trade.
		await session.waitFor('Alice', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'inOffenseTrade';
		});
		const after = await session.snapshot('Alice');
		expect(after.players[aliceId]?.quarantine).toBe(0);
		expect(after.players[bobId]?.quarantine).toBe(0);
		expect(after.players[carolId]?.quarantine).toBe(0);
		expect(after.players[daveId]?.quarantine).toBe(0);
		expect(after.players[aliceId]?.turnState).toBe('inOffenseTrade');
	});
});
