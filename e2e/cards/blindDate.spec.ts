import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Паника «Свидание вслепую» (blindDate): игрок меняет одну карту с руки на
// верхнюю карту колоды (паники по пути сбрасываются), после чего ход переходит
// в обычный обмен с соседом. Паника НЕ попадает в руку — её достают из колоды
// через cardPick. Зеркалит blindDateTest.ts.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Свидание вслепую (blindDate)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('меняет одну карту руки на карту из колоды, затем ход уходит в обмен', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {
				Alice: fill(['whiskey'], 4),
				Bob: fill([], 4),
			},
			// Паника первой, затем карта события, которую возьмут взамен.
			deck: ['blindDate', 'suspicion'],
		});

		// Alice тянет карту -> попадается паника blindDate.
		await session.cardPick('Alice');

		// makePanic сначала рассылает всем okayCard «Alice достает карту паники».
		await session.waitFor('Bob', (s) =>
			s.notifications.some((n) => n.type === 'okayCard' && (n.text ?? '').includes('достает карту паники')),
		);

		// Затем Alice получает выбор карты (selectCard) для обмена.
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'selectCard');
		const offered = (await session.snapshot('Alice')).currentAction?.cards ?? {};
		expect(Object.values(offered).map((c) => c.id)).toContain('whiskey');

		// Alice сбрасывает whiskey и берёт suspicion из колоды.
		await session.selectNotificationCard('Alice', 'whiskey');

		await session.waitFor('Alice', (s) => Object.values(s.hand).some((c) => c.id === 'suspicion'));
		const snap = await session.snapshot('Alice');
		// whiskey ушёл, паника в руку не попала, рука снова 4 карты.
		expect(Object.values(snap.hand).some((c) => c.id === 'whiskey')).toBe(false);
		expect(Object.values(snap.hand).some((c) => c.id === 'blindDate')).toBe(false);
		expect(Object.keys(snap.hand).length).toBe(4);
		// Как и в юнит-тесте: после паники игрок переходит в обмен с соседом.
		expect(snap.players[snap.currentPlayerId!]?.turnState).toBe('inOffenseTrade');
	});
});
