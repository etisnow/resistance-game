import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Паника «УУУПС!» (oops): «Покажите все свои карты остальным игрокам».
// Карты паники не лежат в руке — их вытягивают из колоды. Мы кладём панику
// наверх колоды, ставим ходящего игрока в фазу взятия карты (inCardPick) и
// вызываем cardPick — движок берёт панику и запускает makePanic. makePanic
// пишет в лог «<ник> достает карту паники ...» (саму карту стол показывает в
// центре — см. panicCard.test.ts), затем oopsAct показывает всем ПРОЧИМ игрокам
// руку ходящего (okayCard «<ник>: УУУПС!» с картами руки) и переводит ходящего
// в inOffenseTrade.
//
// Зеркало oopsTest.ts:
//   expectOkayCard(APlayer, arrayContaining(offensePlayer.hand))
//   offensePlayer.turnState === inOffenseTrade
//   game.turnContext.type === trade

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Паника УУУПС! (oops)', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('ходящий показывает всю руку остальным, затем уходит в обмен', async () => {
		// Ходящему Alice даём ровно 4 карты (рука перед взятием), а на верх колоды
		// кладём панику oops. Остальные карты в колоде — обычные события, чтобы
		// после паники колода была валидной.
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {
				Alice: fill(['suspicion', 'barricade', 'seduction', 'whiskey'], 4),
			},
			deck: ['oops', 'analysis', 'analysis', 'analysis'],
		});

		// До взятия Alice в фазе cardPick.
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'cardPick');
		const aliceHand = Object.values((await session.snapshot('Alice')).hand)
			.map((c) => c.id)
			.sort();
		expect(aliceHand).toEqual(['barricade', 'seduction', 'suspicion', 'whiskey']);

		// Alice тянет карту — попадается паника, запускается makePanic + oopsAct.
		await session.cardPick('Alice');

		// Каждый прочий игрок (например Bob) получает okayCard «УУУПС!» с полной
		// рукой Alice — единственное уведомление этой паники.
		await session.waitFor('Bob', (s) =>
			s.notifications.some(
				(n) => n.type === 'okayCard' && !!n.text && n.text.includes('УУУПС'),
			),
		);
		const bob = await session.snapshot('Bob');
		const reveal = bob.notifications.find(
			(n) => n.type === 'okayCard' && !!n.text && n.text.includes('УУУПС'),
		);
		expect(reveal).toBeTruthy();
		expect(reveal!.text).toContain('Alice');
		const revealed = Object.values(reveal!.cards ?? {})
			.map((c) => c.id)
			.sort();
		// Вся рука Alice раскрыта Bob'у (arrayContaining(offensePlayer.hand)).
		expect(revealed).toEqual(['barricade', 'seduction', 'suspicion', 'whiskey']);

		// Само вытягивание паники Bob видит строкой лога, а не отдельным окном.
		expect(bob.gameLog.some((l) => l.includes('достает карту паники'))).toBe(true);

		// Ходящий Alice переходит в наступательный обмен (turnContext.type === trade).
		await session.waitFor('Alice', (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return me?.turnState === 'inOffenseTrade';
		});
		const alice = await session.snapshot('Alice');
		expect(alice.players[alice.currentPlayerId!]?.turnState).toBe('inOffenseTrade');
		// Рука Alice не изменилась (паника не добавляется в руку, лишь сбрасывается).
		expect(Object.values(alice.hand).map((c) => c.id).sort()).toEqual([
			'barricade',
			'seduction',
			'suspicion',
			'whiskey',
		]);
	});
});
