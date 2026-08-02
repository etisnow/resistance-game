import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame} from '../helpers/nechto';

// Паника "Только между нами" (onlyBetweenUs): игрок показывает ВСЕ свои карты
// выбранному соседу — выбранный получает okayCard со всей рукой показывающего.
// Паника не лежит в руке — её ТЯНУТ. Соседи Alice (рассадка NICKS по часовой):
// Bob (справа) и Erin (слева). Зеркалит onlyBetweenUsTest.ts и серверный экшен
// onlyBetweenUs.ts.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Только между нами (onlyBetweenUs)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('показывает всю руку выбранному соседу — тот получает okayCard с картами', async () => {
		// Даём Alice узнаваемую руку из 4 карт; сверху колоды лежит паника.
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {Alice: ['suspicion', 'barricade', 'seduction', 'whiskey']},
			deck: ['onlyBetweenUs', 'analysis', 'analysis', 'analysis'],
		});

		const aliceId = await session.idOf('Alice');
		const bobId = await session.idOf('Bob');
		const carolId = await session.idOf('Carol');
		const daveId = await session.idOf('Dave');
		const erinId = await session.idOf('Erin');

		// Рука Alice до паники.
		const handBefore = Object.values((await session.snapshot('Alice')).hand)
			.map((c) => c.id)
			.sort();
		expect(handBefore).toEqual(['barricade', 'seduction', 'suspicion', 'whiskey']);

		// Alice тянет карту — срабатывает паника.
		await session.cardPick('Alice');
		await session.waitFor('Alice', (s) =>
			s.gameLog.some((l) => l.includes('достает карту паники')),
		);

		// Alice получает playerSelect: предлагают только соседей Bob и Erin.
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		expect(offered.sort()).toEqual([bobId, erinId].sort());
		expect(offered).not.toContain(aliceId);
		expect(offered).not.toContain(carolId);
		expect(offered).not.toContain(daveId);

		// Alice показывает руку Bob.
		await session.selectPlayer('Alice', 'Bob');

		// Bob получает okayCard с полной рукой Alice.
		await session.waitFor('Bob', (s) =>
			s.notifications.some((n) => n.type === 'okayCard' && !!n.cards && Object.keys(n.cards).length === 4),
		);
		const reveal = (await session.snapshot('Bob')).notifications.find(
			(n) => n.type === 'okayCard' && !!n.cards && Object.keys(n.cards).length === 4,
		);
		const revealed = Object.values(reveal?.cards ?? {})
			.map((c) => c.id)
			.sort();
		expect(revealed).toEqual(['barricade', 'seduction', 'suspicion', 'whiskey']);

		// Alice уходит в offense trade.
		await session.waitFor('Alice', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'inOffenseTrade';
		});
		const after = await session.snapshot('Alice');
		expect(after.players[aliceId]?.turnState).toBe('inOffenseTrade');
	});
});
