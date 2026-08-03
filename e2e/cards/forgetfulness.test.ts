import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Паника «Забывчивость» (forgetfulness): игрок сбрасывает три карты с руки и
// берёт три новых карты событий из колоды (паники по пути сбрасываются), после
// чего ход переходит в обычный обмен с соседом. Паника достаётся из колоды через
// cardPick и в руку не попадает. Зеркалит forgetfulness.test.ts: одно окно
// множественного выбора (selectCards) — три галочки и одно подтверждение.

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

		// В лог всем уходит строка «Alice достает карту паники ...».
		await session.waitFor('Bob', (s) =>
			s.gameLog.some((l) => l.includes('достает карту паники')),
		);

		// Все три карты — в одном окне: ждём его и отмечаем их галочками. Окно
		// должно доехать и до очереди notifications — именно её рисует Notifier.
		const toDiscard = ['whiskey', 'suspicion', 'barricade'];
		await session.waitFor('Alice', (s) => {
			if (s.currentAction?.type !== 'selectCards') return false;
			if (!s.notifications.some((n) => n.type === 'selectCards')) return false;
			const cards = Object.values(s.currentAction.cards ?? {});
			return s.currentAction.count === 3 && toDiscard.every((id) => cards.some((c) => c.id === id));
		});
		for (const [index, cardId] of toDiscard.entries()) {
			await session.checkNotificationCard('Alice', cardId);
			if (index === toDiscard.length - 1) break;
			// Пока набраны не все три, OKEY ничего не меняет — окно на месте.
			await session.confirmSelectedCards('Alice');
			const midSnap = await session.snapshot('Alice');
			expect(midSnap.currentAction?.type).toBe('selectCards');
			expect(midSnap.checkedNotificationCards.length).toBe(index + 1);
		}
		await session.confirmSelectedCards('Alice');

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
