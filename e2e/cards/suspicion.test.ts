import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Подозрение: "Заставьте одного из ваших соседей показать вам одну случайную
// карту со своей руки." Played end to end in the browser: the offense plays the
// card, picks a neighbour, and privately gets an okayCard notification revealing
// exactly one of that neighbour's cards. Then the offense enters the end-of-turn
// trade. Mirrors suspicionTest.ts and the server action suspicion.ts.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Подозрение (suspicion)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('подсматривает одну случайную карту соседа', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['suspicion']),
				Bob: ['fear', 'miss', 'noThanks', 'seduction'],
			},
		});

		await session.play('Alice', 'suspicion');

		// Targets are Alice's neighbours only: Bob (next) and Erin (prev).
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const bobId = await session.idOf('Bob');
		const erinId = await session.idOf('Erin');
		const carolId = await session.idOf('Carol');
		expect(offered.sort()).toEqual([bobId, erinId].sort());
		expect(offered).not.toContain(carolId);

		// Alice peeks at Bob: she privately receives an okayCard with exactly one
		// of Bob's cards.
		await session.selectPlayer('Alice', 'Bob');
		await session.waitFor('Alice', (s) =>
			s.notifications.some((n) => n.type === 'okayCard' && Object.keys(n.cards ?? {}).length === 1),
		);
		const alice = await session.snapshot('Alice');
		const reveal = alice.notifications.find(
			(n) => n.type === 'okayCard' && Object.keys(n.cards ?? {}).length === 1,
		);
		expect(reveal).toBeTruthy();
		const revealed = Object.values(reveal!.cards ?? {});
		expect(revealed.length).toBe(1);
		// The revealed card is genuinely one of Bob's hand cards.
		const bobHand = ['fear', 'miss', 'noThanks', 'seduction'];
		expect(bobHand).toContain(revealed[0]!.id);

		// suspicion was discarded (hand back to 4).
		expect(Object.values(alice.hand).some((c) => c.id === 'suspicion')).toBe(false);
		expect(Object.keys(alice.hand).length).toBe(4);

		// Пока Алиса разглядывает карту, ход стоит на осмотре, и остальные видят на
		// столе стрелку от неё к Бобу (клиент рисует на ней лупу).
		expect(alice.players[alice.currentPlayerId!]?.turnState).toBe('inCardActionProgress');
		await session.waitFor('Carol', (s) =>
			(s.tradeContext ?? []).some((c) => c.type === 'cardsView'),
		);
		const [viewArrow] = (await session.snapshot('Carol')).tradeContext ?? [];
		expect(viewArrow).toMatchObject({
			type: 'cardsView',
			offensePlayerId: await session.idOf('Alice'),
			defensePlayerId: bobId,
			cardId: 'suspicion',
		});

		// Алиса закрывает окно — осмотр подтверждён: стрелка уходит со стола, и
		// начинается обмен.
		await session.confirmCardsView('Alice');
		await session.expectTurnState('Alice', 'inOffenseTrade');
		await session.waitFor('Carol', (s) =>
			!(s.tradeContext ?? []).some((c) => c.type === 'cardsView'),
		);
		expect((await session.snapshot('Carol')).tradeContext?.[0]?.type).toBe('trade');
	});

	test('сосед на карантине не предлагается в качестве цели', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['suspicion']), Bob: fill([], 4)},
			quarantine: {Bob: 3},
		});

		await session.play('Alice', 'suspicion');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const bobId = await session.idOf('Bob');
		const erinId = await session.idOf('Erin');
		// Bob (quarantined) is excluded; only Erin (the other neighbour) remains.
		expect(offered).not.toContain(bobId);
		expect(offered).toEqual([erinId]);
	});
});
