import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame} from '../helpers/nechto';

// Паника «Цепная реакция» (chainReaction): ОДНОВРЕМЕННО все живые игроки
// выбирают по одной карте, и каждый передаёт свою карту следующему игроку по
// кругу (карантин и заколоченная дверь игнорируются, отказаться нельзя). Когда
// все выбрали — карты разом перемещаются соседям, и ход стартового игрока
// заканчивается. Паника достаётся из колоды через cardPick и в руку не попадает.
// Зеркалит chainReactionTest.ts.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Цепная реакция (chainReaction)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('все игроки одновременно передают карту следующему по кругу', async () => {
		// Каждому игроку даём свою уникальную «опознаваемую» карту первой, чтобы
		// проследить, кому она уедет. Все карты играбельны (есть действие сброса).
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {
				Alice: ['suspicion', 'whiskey', 'analysis', 'barricade'],
				Bob: ['seduction', 'whiskey', 'analysis', 'barricade'],
				Carol: ['tenacity', 'whiskey', 'analysis', 'barricade'],
				Dave: ['miss', 'whiskey', 'analysis', 'barricade'],
				Erin: ['fear', 'whiskey', 'analysis', 'barricade'],
			},
			deck: ['chainReaction'],
		});

		// Alice тянет карту -> попадается паника chainReaction.
		await session.cardPick('Alice');

		// В лог всем уходит строка «Alice достает карту паники ...».
		await session.waitFor('Bob', (s) =>
			s.gameLog.some((l) => l.includes('достает карту паники')),
		);

		// Все живые игроки одновременно оказываются в offense-обмене.
		for (const nick of NICKS) {
			const id = await session.idOf(nick);
			await session.waitFor(nick, (s) => s.players[id]?.turnState === 'inOffenseTrade');
		}

		// Каждый выбирает свою опознаваемую карту для передачи. Пока не выбрали
		// все — карты остаются на месте (перемещение происходит атомарно в конце).
		const picks: Record<string, string> = {
			Alice: 'suspicion',
			Bob: 'seduction',
			Carol: 'tenacity',
			Dave: 'miss',
			Erin: 'fear',
		};
		for (const nick of NICKS) {
			await session.offerTrade(nick, picks[nick]!);
		}

		// После последнего выбора карты разом уезжают к следующему по кругу
		// (по часовой: Alice->Bob, Bob->Carol, Carol->Dave, Dave->Erin, Erin->Alice),
		// и ход Alice заканчивается -> следующий игрок Bob тянет карту.
		const bobId = await session.idOf('Bob');
		await session.waitFor('Bob', (s) => s.players[bobId]?.turnState === 'inCardPick');

		// Каждый получил карту своего предыдущего соседа и отдал свою.
		const wantReceived: Record<string, string> = {
			Bob: 'suspicion',
			Carol: 'seduction',
			Dave: 'tenacity',
			Erin: 'miss',
			Alice: 'fear',
		};
		for (const [nick, receivedId] of Object.entries(wantReceived)) {
			await session.waitFor(nick, (s) => Object.values(s.hand).some((c) => c.id === receivedId));
			const snap = await session.snapshot(nick);
			const handIds = Object.values(snap.hand).map((c) => c.id);
			// Получил карту соседа.
			expect(handIds).toContain(receivedId);
			// Отдал свою опознаваемую карту.
			expect(handIds).not.toContain(picks[nick]!);
			// Паника никому в руку не попала.
			expect(handIds).not.toContain('chainReaction');
		}
	});
});
