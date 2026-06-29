import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Анализ: "Посмотрите все карты руки соседнего игрока." Played end to end in the
// browser — the offense plays the card, picks a playable neighbour, and the
// engine reveals that neighbour's full hand back to the offense via an okayCard
// notification. The offense then moves to the trade phase. Mirrors
// analysisTest.ts (offense sees fear/flamethrower/noFire/leaveMeAlone, the
// analysis card is consumed, offense -> inOffenseTrade).

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Анализ (analysis)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('показывает руку соседа и переходит к обмену', async () => {
		const neighbourHand = ['fear', 'flamethrower', 'noFire', 'leaveMeAlone'];
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['analysis'], 5, 'tenacity'),
				Bob: neighbourHand,
			},
		});

		// Alice plays analysis and is asked to pick a neighbour to analyse.
		await session.play('Alice', 'analysis');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const bobId = await session.idOf('Bob');
		const erinId = await session.idOf('Erin');
		// Only the two playable neighbours (Bob = next, Erin = prev) are offerable.
		expect(offered.sort()).toEqual([bobId, erinId].sort());

		// Alice selects Bob; the reveal of Bob's full hand comes back as an okayCard.
		await session.selectPlayer('Alice', 'Bob');
		await session.waitFor('Alice', (s) => s.notifications.some((n) => n.type === 'okayCard' && !!n.cards));
		const reveal = (await session.snapshot('Alice')).notifications.find((n) => n.type === 'okayCard' && !!n.cards);
		const revealedIds = Object.values(reveal?.cards ?? {}).map((c) => c.id).sort();
		expect(revealedIds).toEqual([...neighbourHand].sort());

		// The analysis card is consumed and Alice moves into the offense trade.
		const snap = await session.snapshot('Alice');
		expect(Object.values(snap.hand).some((c) => c.id === 'analysis')).toBe(false);
		expect(Object.values(snap.hand).length).toBe(4);
		expect(snap.players[snap.currentPlayerId!]?.turnState).toBe('inOffenseTrade');
		// Bob is untouched: still a normal idle player who keeps his hand.
		expect(snap.players[bobId]?.turnState).toBe('idle');
		const bob = await session.snapshot('Bob');
		expect(Object.values(bob.hand).map((c) => c.id).sort()).toEqual([...neighbourHand].sort());
	});

	test('анализирует предыдущего соседа (Erin)', async () => {
		const erinHand = ['miss', 'leaveMeAlone', 'suspicion', 'whiskey'];
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['analysis'], 5, 'tenacity'),
				Erin: erinHand,
			},
		});

		await session.play('Alice', 'analysis');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Alice', 'Erin');

		await session.waitFor('Alice', (s) => s.notifications.some((n) => n.type === 'okayCard' && !!n.cards));
		const reveal = (await session.snapshot('Alice')).notifications.find((n) => n.type === 'okayCard' && !!n.cards);
		expect(Object.values(reveal?.cards ?? {}).map((c) => c.id).sort()).toEqual([...erinHand].sort());
		await session.expectTurnState('Alice', 'inOffenseTrade');
	});

	test('карантинный сосед не предлагается как цель', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['analysis'], 5, 'tenacity'),
				Bob: fill([], 4),
				Erin: fill([], 4),
			},
			quarantine: {Bob: 2},
		});

		await session.play('Alice', 'analysis');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const bobId = await session.idOf('Bob');
		const erinId = await session.idOf('Erin');
		// Quarantined Bob is excluded; only Erin remains a valid neighbour.
		expect(offered).not.toContain(bobId);
		expect(offered).toContain(erinId);
	});

	test('отмена возвращает карту анализа в руку', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['analysis'], 5, 'tenacity'),
				Bob: fill([], 4),
			},
		});

		await session.play('Alice', 'analysis');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		// During the player-select step cancel is offered.
		expect((await session.snapshot('Alice')).isPlayerCanCancel).toBe(true);

		await session.cancel('Alice');
		// Back in the action phase, the analysis card is still in hand.
		await session.expectTurnState('Alice', 'inCardAction');
		const snap = await session.snapshot('Alice');
		expect(Object.values(snap.hand).some((c) => c.id === 'analysis')).toBe(true);
	});
});
