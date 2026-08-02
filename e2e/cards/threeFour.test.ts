import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Паника «3, 4!» (threeFour): «Все разыгранные карты "Заколоченная дверь"
// сбрасываются». threeFourAct фильтрует playersList, оставляя только живых
// dummy-игроков (двери — state==='door', не isAlive — выпадают), затем ходящий
// переходит в inOffenseTrade.
//
// Зеркало threeFourTest.ts:
//   playersList === только dummy-игроки (двери удалены)
//   offensePlayer.turnState === inOffenseTrade
//   game.turnContext.type === trade
//
// Карты паники вытягиваются из колоды: arrange turnState:'inCardPick', панику
// наверх колоды, затем cardPick. Двери в раскладку добавляются через
// `doors: [{after: nick}]` (e2eSetup вставляет игрока state==='door').

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Паника 3, 4! (threeFour)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('без дверей: ходящий тянет панику и уходит в обмен, список не меняется', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {
				Alice: fill([], 4),
			},
			deck: ['threeFour', 'analysis', 'analysis', 'analysis'],
		});

		await session.waitFor('Alice', (s) => s.currentAction?.type === 'cardPick');
		const before = (await session.snapshot('Alice')).playersList;
		expect(before.length).toBe(5);

		// Alice тянет панику threeFour.
		await session.cardPick('Alice');

		// В лог всем уходит строка про вытягивание карты паники.
		await session.waitFor('Bob', (s) =>
			s.gameLog.some((l) => l.includes('достает карту паники')),
		);

		// Ходящий переходит в наступательный обмен (turnContext.type === trade).
		await session.waitFor('Alice', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'inOffenseTrade';
		});
		const after = await session.snapshot('Alice');
		expect(after.players[after.currentPlayerId!]?.turnState).toBe('inOffenseTrade');
		// Дверей не было — playersList остаётся прежним (все живые dummy).
		expect(after.playersList).toEqual(before);
		expect(
			after.playersList.every((id) => after.players[id]?.state === 'dummy'),
		).toBe(true);
	});

	test('сбрасывает заколоченные двери из playersList', async () => {
		// Расставляем две двери (между Bob/Carol и между Dave/Erin); threeFour
		// должна обе сбросить.
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {Alice: fill([], 4)},
			deck: ['threeFour', 'analysis', 'analysis'],
			doors: [{after: 'Bob'}, {after: 'Dave'}],
		});

		const before = await session.snapshot('Alice');
		expect(before.playersList.filter((id) => before.players[id]?.state === 'door').length).toBe(2);

		await session.cardPick('Alice');

		// Двери удалены из playersList, ходящий уходит в наступательный обмен.
		await session.waitFor('Alice', (s) => s.playersList.every((id) => s.players[id]?.state !== 'door'));
		const after = await session.snapshot('Alice');
		expect(after.playersList.filter((id) => after.players[id]?.state === 'door').length).toBe(0);
		expect(after.playersList.length).toBe(5);
		await session.expectTurnState('Alice', 'inOffenseTrade');
	});
});
