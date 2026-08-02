import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from '../helpers/nechto';

// Сработавшая паника лежит крупно в центре СТОЛА (а не отдельным окном поверх
// всего): сервер держит её всё время события паники (Game.panicCard +
// syncPanicCard), клиент — ещё и не меньше своей выдержки panicCardMinMs
// (в проде 5 секунд), чтобы её успели прочитать. На появлении карта
// переворачивается с рубашки на лицо — это чистая анимация клиента, состоянию
// игры она не видна. Пока карта на столе, из колоды не тянут: нажатие по колоде
// не теряется, а исполняется, когда карта уйдёт (GameController.cardPick).
//
// Остальные панические спеки идут с укороченной выдержкой (startGame опускает
// её, иначе каждая паника стоила бы 5 секунд ожидания) — настоящую проверяет
// этот спек.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];
const HOLD_MS = 5000;

test.describe.serial('Карта паники на столе', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
		await session.setPanicHold(HOLD_MS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('мгновенная паника всё равно висит на столе у всех и без окна', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {Alice: fill([], 4)},
			// oldRopes отыгрывается мгновенно: сервер снимает карту сразу же, на
			// столе её держит уже клиент.
			deck: ['oldRopes', 'analysis', 'analysis', 'analysis'],
		});

		await session.cardPick('Alice');

		// Карта видна и ходящему, и остальным.
		await session.waitFor('Alice', (s) => s.panicCard?.id === 'oldRopes');
		await session.waitFor('Erin', (s) => s.panicCard?.id === 'oldRopes');

		// Событие паники давно отыграно (Alice уже в обмене), а карта всё ещё на
		// столе — это и есть выдержка на чтение.
		await session.expectTurnState('Alice', 'inOffenseTrade');
		expect((await session.snapshot('Alice')).panicCard?.id).toBe('oldRopes');

		// Отдельного окна с картой паники больше нет — только строка лога.
		const erin = await session.snapshot('Erin');
		expect(erin.notifications.some((n) => (n.text ?? '').includes('достает карту паники'))).toBe(false);
		expect(erin.gameLog.some((l) => l.includes('достает карту паники'))).toBe(true);

		// И карта уходит сама, никого не спрашивая.
		await session.waitFor('Erin', (s) => !s.panicCard, HOLD_MS + 5_000);
	});

	test('пока карта на столе, из колоды не тянут', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {
				Alice: fill([], 4),
				Bob: fill([], 4),
				Carol: fill([], 4),
				Dave: fill([], 4),
				Erin: fill([], 4),
			},
			deck: ['chainReaction', 'analysis', 'analysis', 'analysis', 'suspicion'],
		});

		await session.cardPick('Alice');
		await session.waitFor('Alice', (s) => s.panicCard?.id === 'chainReaction');

		// Цепная реакция: карта лежит на столе всё время события — все пятеро
		// отдают по карте, и только тогда ход уходит дальше.
		for (const nick of NICKS) {
			await session.expectTurnState(nick, 'inOffenseTrade');
			await session.offerTrade(nick, 'analysis');
		}

		// Ход у Bob, он должен взять карту — но паника ещё на столе.
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'cardPick');
		const before = await session.snapshot('Bob');
		expect(before.panicCard?.id).toBe('chainReaction');
		const handSize = Object.keys(before.hand).length;

		// Нажатие по колоде (тот же вызов, что и у обработчика на канвасе) сейчас
		// карту не даёт — но и не теряется: оно исполнится, когда паника уйдёт.
		await session.page('Bob').evaluate(() => {
			(window as unknown as {__nechto: {cardPick(): void}}).__nechto.cardPick();
		});
		await session.page('Bob').waitForTimeout(400);
		const blocked = await session.snapshot('Bob');
		expect(Object.keys(blocked.hand).length).toBe(handSize);
		expect(blocked.currentAction?.type).toBe('cardPick');

		// Карта ушла — отложенное нажатие сработало само, карта пришла в руку.
		await session.waitFor('Bob', (s) => !s.panicCard, HOLD_MS + 5_000);
		await session.waitFor('Bob', (s) => Object.keys(s.hand).length === handSize + 1);
	});
});
