import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Паника "Убирайся прочь" (goAway): игрок меняется местами с любым игроком не на
// карантине по своему выбору (не только с соседом). Паника не лежит в руке — её
// ТЯНУТ: ход в фазе inCardPick, в колоде сверху лежит паника, игрок берёт карту
// (cardPick) и паника срабатывает. makePanic сперва шлёт всем okayCard
// "<ник> достает карту паники", затем запускается эффект — playerSelect.
// Зеркалит goAwayTest.ts и серверный экшен goAway.ts.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Убирайся прочь (goAway)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('меняется местами с выбранным игроком; игрок на карантине исключён', async () => {
		// Alice в фазе взятия карты с 4 картами; сверху колоды лежит паника goAway.
		// Carol на карантине — её нельзя выбрать целью.
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {Alice: fill([], 4)},
			deck: ['goAway', 'analysis', 'analysis', 'analysis'],
			quarantine: {Carol: 3},
		});

		const aliceId = await session.idOf('Alice');
		const bobId = await session.idOf('Bob');
		const carolId = await session.idOf('Carol');
		const daveId = await session.idOf('Dave');
		const erinId = await session.idOf('Erin');

		// Запоминаем исходный порядок игроков (позиции Alice и Dave).
		const before = await session.snapshot('Alice');
		const aliceBefore = before.playersList.indexOf(aliceId);
		const daveBefore = before.playersList.indexOf(daveId);

		// Alice тянет карту — срабатывает паника.
		await session.cardPick('Alice');

		// Всем (включая Alice) пришёл okayCard "Alice достает карту паники".
		await session.waitFor('Alice', (s) =>
			s.notifications.some((n) => n.type === 'okayCard' && (n.text ?? '').includes('достает карту паники')),
		);

		// Alice получает playerSelect: предлагают всех кроме неё и кроме Carol (карантин).
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		expect(offered).not.toContain(aliceId);
		expect(offered).not.toContain(carolId);
		expect(offered.sort()).toEqual([bobId, daveId, erinId].sort());

		// Alice меняется местами с Dave.
		await session.selectPlayer('Alice', 'Dave');

		// После обмена Alice занимает позицию Dave и наоборот; Alice уходит в торговлю.
		await session.waitFor('Alice', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'inOffenseTrade';
		});
		const after = await session.snapshot('Alice');
		expect(after.playersList.indexOf(aliceId)).toBe(daveBefore);
		expect(after.playersList.indexOf(daveId)).toBe(aliceBefore);
		expect(after.players[aliceId]?.turnState).toBe('inOffenseTrade');
		expect(after.players[daveId]?.turnState).toBe('idle');
	});
});
