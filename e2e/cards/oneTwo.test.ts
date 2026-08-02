import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Паника "Раз-два" (oneTwo): игрок меняется местами с ТРЕТЬИМ игроком по часовой
// или против часовой стрелке на свой выбор, игнорируя двери; если выбранный
// (третий) игрок на карантине — обмена с ним нет. Паника не лежит в руке — её
// ТЯНУТ. Для рассадки NICKS = [Alice, Bob, Carol, Dave, Erin] по часовой:
// третий по часовой от Alice = Dave, третий против часовой = Carol
// (см. getPlayerByStep). Зеркалит oneTwoTest.ts и серверный экшен oneTwo.ts.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Раз-два (oneTwo)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('меняется местами с третьим игроком (Dave или Carol)', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {Alice: fill([], 4)},
			deck: ['oneTwo', 'analysis', 'analysis', 'analysis'],
		});

		const aliceId = await session.idOf('Alice');
		const bobId = await session.idOf('Bob');
		const carolId = await session.idOf('Carol');
		const daveId = await session.idOf('Dave');
		const erinId = await session.idOf('Erin');

		const before = await session.snapshot('Alice');
		const aliceBefore = before.playersList.indexOf(aliceId);
		const daveBefore = before.playersList.indexOf(daveId);

		await session.cardPick('Alice');
		await session.waitFor('Alice', (s) =>
			s.gameLog.some((l) => l.includes('достает карту паники')),
		);

		// Предлагают РОВНО третьего по часовой (Dave) и третьего против (Carol);
		// прямые соседи (Bob, Erin) и сама Alice не предлагаются.
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		expect(offered.sort()).toEqual([carolId, daveId].sort());
		expect(offered).not.toContain(aliceId);
		expect(offered).not.toContain(bobId);
		expect(offered).not.toContain(erinId);

		// Alice меняется местами с Dave.
		await session.selectPlayer('Alice', 'Dave');
		await session.waitFor('Alice', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'inOffenseTrade';
		});
		const after = await session.snapshot('Alice');
		expect(after.playersList.indexOf(aliceId)).toBe(daveBefore);
		expect(after.playersList.indexOf(daveId)).toBe(aliceBefore);
		expect(after.players[aliceId]?.turnState).toBe('inOffenseTrade');
	});

	test('оба третьих игрока на карантине — обмена нет, ход идёт в торговлю', async () => {
		// Оба кандидата (Dave по часовой, Carol против) на карантине → selectPlayersId
		// пуст → playerSelect не приходит, Alice сразу уходит в offense trade без обмена.
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {Alice: fill([], 4)},
			deck: ['oneTwo', 'analysis', 'analysis', 'analysis'],
			quarantine: {Carol: 3, Dave: 3},
		});

		const aliceId = await session.idOf('Alice');
		const before = await session.snapshot('Alice');
		const aliceBefore = before.playersList.indexOf(aliceId);

		await session.cardPick('Alice');
		await session.waitFor('Alice', (s) =>
			s.gameLog.some((l) => l.includes('достает карту паники')),
		);

		// Без playerSelect: Alice сразу в offense trade.
		await session.waitFor('Alice', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'inOffenseTrade';
		});
		const after = await session.snapshot('Alice');
		expect(after.currentAction?.type).not.toBe('playerSelect');
		// Позиция Alice не изменилась — обмена не было.
		expect(after.playersList.indexOf(aliceId)).toBe(aliceBefore);
		expect(after.players[aliceId]?.turnState).toBe('inOffenseTrade');
	});
});
