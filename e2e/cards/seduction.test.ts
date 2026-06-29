import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Соблазн: "Поменяйтесь одной картой с любым игроком по вашему выбору. После
// этого ваш ход заканчивается." Played end to end in the browser: the offense
// plays the card, picks ANY non-quarantined player (not just a neighbour),
// then enters a normal trade with that chosen player as defense. Mirrors
// seductionTest.ts and the server action seduction.ts.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Соблазн (seduction)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('меняется картой с любым игроком (не соседом) и ход переходит дальше', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: ['seduction', 'miss', 'analysis', 'barricade', 'whiskey'],
				Carol: fill(['fear'], 4),
			},
		});

		await session.play('Alice', 'seduction');

		// Alice is offered EVERY non-quarantined player except herself — including
		// the non-neighbours Carol and Dave.
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const aliceId = await session.idOf('Alice');
		const bobId = await session.idOf('Bob');
		const carolId = await session.idOf('Carol');
		const daveId = await session.idOf('Dave');
		const erinId = await session.idOf('Erin');
		expect(offered.sort()).toEqual([bobId, carolId, daveId, erinId].sort());
		expect(offered).not.toContain(aliceId);

		// Alice chooses Carol (a non-neighbour) — seduction is discarded and the
		// offense enters a trade with Carol as defense.
		await session.selectPlayer('Alice', 'Carol');
		await session.expectTurnState('Alice', 'inOffenseTrade');
		const afterSelect = await session.snapshot('Alice');
		expect(Object.values(afterSelect.hand).some((c) => c.id === 'seduction')).toBe(false);

		// Alice offers miss; Carol is asked to give a card back.
		await session.offerTrade('Alice', 'miss');
		await session.expectTurnState('Carol', 'inDefenseTrade');

		// Carol gives fear back; the swap completes and Alice's turn ends.
		await session.offerTrade('Carol', 'fear');

		await session.waitFor('Alice', (s) => Object.values(s.hand).some((c) => c.id === 'fear'));
		const alice = await session.snapshot('Alice');
		expect(alice.players[alice.currentPlayerId!]?.turnState).toBe('idle');
		expect(Object.values(alice.hand).some((c) => c.id === 'miss')).toBe(false);

		// Carol received miss, lost fear, and (as the chosen trade partner, not
		// the seating-order successor) returns to idle.
		const carol = await session.snapshot('Carol');
		expect(Object.values(carol.hand).some((c) => c.id === 'miss')).toBe(true);
		expect(Object.values(carol.hand).some((c) => c.id === 'fear')).toBe(false);
		expect(carol.players[carol.currentPlayerId!]?.turnState).toBe('idle');

		// The turn ends to Alice's seating successor (Bob), who must now draw.
		await session.expectTurnState('Bob', 'inCardPick');
	});

	test('игрок на карантине не предлагается в качестве цели', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['seduction']), Bob: fill([], 4)},
			quarantine: {Bob: 3},
		});

		await session.play('Alice', 'seduction');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'playerSelect');
		const offered = (await session.snapshot('Alice')).currentAction?.playersToSelect ?? [];
		const bobId = await session.idOf('Bob');
		const carolId = await session.idOf('Carol');
		const daveId = await session.idOf('Dave');
		const erinId = await session.idOf('Erin');
		// Bob (quarantined) is excluded; everyone else remains offered.
		expect(offered).not.toContain(bobId);
		expect(offered.sort()).toEqual([carolId, daveId, erinId].sort());
	});
});
