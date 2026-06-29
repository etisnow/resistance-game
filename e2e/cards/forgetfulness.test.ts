import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Паника «Забывчивость» (forgetfulness): игрок сбрасывает три карты с руки и
// берёт три новых карты событий из колоды (паники по пути сбрасываются), после
// чего ход переходит в обычный обмен с соседом. Паника достаётся из колоды через
// cardPick и в руку не попадает. Зеркалит forgetfulnessTest.ts: три
// последовательных шага selectCard (контекст forgetfullnessSelect).

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Забывчивость (forgetfulness)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('сбрасывает три карты, берёт три новых, затем ход уходит в обмен', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {
				Alice: ['whiskey', 'suspicion', 'barricade', 'seduction'],
				Bob: fill([], 4),
			},
			// Паника первой, затем три карты события, которые возьмут взамен.
			deck: ['forgetfulness', 'analysis', 'tenacity', 'miss'],
		});

		// Alice тянет карту -> попадается паника forgetfulness.
		await session.cardPick('Alice');

		// Всем приходит okayCard «Alice достает карту паники».
		await session.waitFor('Bob', (s) =>
			s.notifications.some((n) => n.type === 'okayCard' && (n.text ?? '').includes('достает карту паники')),
		);

		// Сбрасываем три карты по очереди — каждый раз новый selectCard.
		const toDiscard = ['whiskey', 'suspicion', 'barricade'];
		for (const cardId of toDiscard) {
			await session.waitFor('Alice', (s) => {
				const cards = s.currentAction?.type === 'selectCard' ? s.currentAction.cards ?? {} : {};
				return Object.values(cards).some((c) => c.id === cardId);
			});
			await session.selectNotificationCard('Alice', cardId);
		}

		// После третьего выбора игрок берёт три карты и переходит в обмен.
		await session.waitFor('Alice', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'inOffenseTrade';
		});
		const snap = await session.snapshot('Alice');
		const handIds = Object.values(snap.hand).map((c) => c.id);
		// Сброшенные карты ушли с руки.
		for (const cardId of toDiscard) {
			expect(handIds).not.toContain(cardId);
		}
		// Паника в руку не попала, рука осталась из 4 карт (1 несброшенная + 3 новые).
		expect(handIds).not.toContain('forgetfulness');
		expect(handIds.length).toBe(4);
		// seduction (несброшенная) на месте, новые карты из колоды добавились.
		expect(handIds).toContain('seduction');
	});
});
