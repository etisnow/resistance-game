import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Оглянись: "Измените направление хода." A non-targeted offense card. Mirrors
// lookAroundTest.ts: playing it flips game.isClockwise, the card is consumed,
// the offense goes straight to the offense trade (no player-select step), and
// an okayCard ("<nick> изменил направление хода") is broadcast to every player.
//
// isClockwise is not in the snapshot, so we verify the reversal by its
// consequence: after reversing, the offense's trade partner becomes the player
// who was PREVIOUS in clockwise order (Erin) instead of the next one (Bob).

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Оглянись (lookaround)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('меняет направление: карта сыграна без выбора цели, оффенс идёт к обмену', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['lookaround']),
				Bob: fill([], 4),
			},
		});

		// Non-targeted: no playerSelect step, straight to the offense trade.
		await session.play('Alice', 'lookaround');
		await session.expectTurnState('Alice', 'inOffenseTrade');

		const snap = await session.snapshot('Alice');
		// The lookaround card is consumed (4 cards left, none is lookaround).
		expect(Object.values(snap.hand).some((c) => c.id === 'lookaround')).toBe(false);
		expect(Object.values(snap.hand).length).toBe(4);
		// The direction-change is recorded in the game log.
		expect(snap.gameLog.some((l) => l.includes('изменил направление хода'))).toBe(true);
	});

	test('уведомление о смене направления приходит всем игрокам', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['lookaround']),
				Bob: fill([], 4),
			},
		});

		await session.play('Alice', 'lookaround');

		// Every player (turn player and a non-turn player) receives the okayCard.
		const matches = (s: {notifications: {type: string; text?: string}[]}): boolean =>
			s.notifications.some((n) => n.type === 'okayCard' && (n.text ?? '').includes('изменил направление хода'));
		await session.waitFor('Alice', matches);
		await session.waitFor('Bob', matches);
	});

	test('после смены направления оффенс торгует с предыдущим игроком (Erin)', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {
				Alice: fill(['lookaround', 'suspicion']),
				Bob: fill([], 4),
				Erin: fill([], 4),
			},
		});

		await session.play('Alice', 'lookaround');
		await session.expectTurnState('Alice', 'inOffenseTrade');

		// Alice offers a trade. Because direction reversed, her partner is Erin
		// (the previous player), not Bob (the next).
		await session.offerTrade('Alice', 'suspicion');
		await session.expectTurnState('Erin', 'inDefenseTrade');

		// Bob, the would-be partner under the original direction, is untouched.
		const bobId = await session.idOf('Bob');
		const snap = await session.snapshot('Alice');
		expect(snap.players[bobId]?.turnState).not.toBe('inDefenseTrade');
	});
});
