import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Паника «И это вы называете вечеринкой?» (youCallThisParty): «Все карантины и
// двери сбрасываются, затем, начиная с тянущего, игроки попарно меняются
// местами (лишний остаётся на месте)».
//
// youCallThisPartyAct:
//   1) фильтрует playersList до живых dummy, попутно обнуляя quarantine у всех;
//   2) поворачивает список так, чтобы тянущий встал в начало;
//   3) идёт по нечётным индексам и меняет местами соседние пары (swapPlayers);
//   4) переводит тянущего в inOffenseTrade.
//
// Для NICKS=[Alice,Bob,Carol,Dave,Erin], ход Alice, без дверей, итоговый
// порядок: ротация уже [Alice,Bob,Carol,Dave,Erin]; меняем пары (Alice,Bob) и
// (Carol,Dave), Erin (индекс 4) остаётся -> [Bob, Alice, Dave, Carol, Erin].
// Это та же механика, что в youCallThisPartyTest.ts (там для 5 живых после
// удаления двери получалось [C, A, E, D, F]).
//
// ОГРАНИЧЕНИЕ ДВЕРЕЙ: дверь в playersList можно создать только баррикадой, но
// arrange() (через который только и задаётся колода с паникой и фаза взятия)
// удаляет всех не-NICKS игроков. Поэтому проверку «двери сброшены» через
// харнесс воспроизвести нельзя; здесь покрываем сброс карантинов и попарную
// перестановку, что является основным наблюдаемым эффектом паники.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Паника И это вы называете вечеринкой? (youCallThisParty)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('сбрасывает карантины и попарно меняет игроков местами', async () => {
		// Несколько игроков в карантине — паника должна обнулить их все.
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {
				Alice: fill([], 4),
			},
			deck: ['youCallThisParty', 'analysis', 'analysis', 'analysis'],
			quarantine: {Bob: 3, Dave: 2, Erin: 1},
		});

		await session.waitFor('Alice', (s) => s.currentAction?.type === 'cardPick');
		const before = await session.snapshot('Alice');
		expect(before.playersList).toEqual([
			await session.idOf('Alice'),
			await session.idOf('Bob'),
			await session.idOf('Carol'),
			await session.idOf('Dave'),
			await session.idOf('Erin'),
		]);
		const bobId = await session.idOf('Bob');
		const daveId = await session.idOf('Dave');
		const erinId = await session.idOf('Erin');
		expect(before.players[bobId]?.quarantine).toBe(3);
		expect(before.players[daveId]?.quarantine).toBe(2);
		expect(before.players[erinId]?.quarantine).toBe(1);

		// Alice тянет панику youCallThisParty.
		await session.cardPick('Alice');

		// В лог всем уходит строка про вытягивание карты паники.
		await session.waitFor('Bob', (s) =>
			s.gameLog.some((l) => l.includes('достает карту паники')),
		);

		// Ходящий уходит в наступательный обмен.
		await session.waitFor('Alice', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'inOffenseTrade';
		});

		const aliceId = await session.idOf('Alice');
		const carolId = await session.idOf('Carol');

		// Дожидаемся применённой попарной перестановки.
		const expectedOrder = [bobId, aliceId, daveId, carolId, erinId];
		await session.waitFor('Alice', (s) => s.playersList.join(',') === expectedOrder.join(','));

		const after = await session.snapshot('Alice');
		// Попарная перестановка: (Alice,Bob) и (Carol,Dave) поменялись, Erin остался.
		expect(after.playersList).toEqual(expectedOrder);

		// Все карантины обнулены.
		for (const id of after.playersList) {
			expect(after.players[id]?.quarantine).toBe(0);
		}

		expect(after.players[after.currentPlayerId!]?.turnState).toBe('inOffenseTrade');
	});
});
