import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, fill} from './helpers/nechto';

// Концовки игры, воспроизведённые в браузере:
//  • «Нечто победило» — все люди заражены (Нечто передаёт последнюю карту
//    заражения чистому игроку);
//  • «Нечто проиграло» (победили люди) — Нечто сжигают огнемётом.
// Конец игры приходит как уведомление gameEnd; его текст содержит «справился»
// (Нечто выполнило задание) либо «не справился» (Нечто проиграло).

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Концовки игры', () => {
	let session: GameSession;

	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});

	test.afterAll(async () => {
		await session.close();
	});

	test('Нечто побеждает, когда заражены все люди', async () => {
		// Все люди уже заражены, кроме Bob. Alice (Нечто) передаёт ему заражение
		// в обмене — чистых не остаётся, Нечто выигрывает.
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			things: ['Alice'],
			infected: ['Carol', 'Dave', 'Erin'],
			hands: {
				Alice: ['infect', 'analysis', 'suspicion', 'barricade', 'whiskey'],
				Bob: ['fear', 'miss', 'noThanks', 'seduction'],
			},
		});

		await session.discard('Alice', 'analysis');
		await session.expectTurnState('Alice', 'inOffenseTrade');
		await session.offerTrade('Alice', 'infect');
		await session.expectTurnState('Bob', 'inDefenseTrade');
		await session.offerTrade('Bob', 'fear');

		// Передача заражения последнему чистому игроку завершает игру победой Нечто.
		await session.waitFor('Bob', (s) => s.notifications.some((n) => n.type === 'gameEnd'));
		const end = (await session.snapshot('Bob')).notifications.find((n) => n.type === 'gameEnd');
		expect(end?.text).toContain('справился');
		expect(end?.text).not.toContain('не справился');
		// Все игроки получают тот же финал.
		const aliceEnd = (await session.snapshot('Alice')).notifications.find((n) => n.type === 'gameEnd');
		expect(aliceEnd?.text).toContain('справился');
	});

	test('Люди побеждают, когда сжигают Нечто', async () => {
		// Bob — обычный игрок с огнемётом; его сосед Alice — Нечто. Сжигание
		// Нечто завершает игру поражением Нечто.
		await session.arrange({
			players: NICKS,
			turn: 'Bob',
			things: ['Alice'],
			hands: {
				Bob: fill(['flamethrower']),
				Alice: fill([], 4),
			},
		});

		await session.play('Bob', 'flamethrower');
		await session.waitFor('Bob', (s) => s.currentAction?.type === 'playerSelect');
		await session.selectPlayer('Bob', 'Alice');
		await session.waitFor('Alice', (s) => s.currentAction?.type === 'actionDecision');
		await session.decide('Alice', 'burn');

		// Итог партии ждёт, пока догорит костёр: сожжение приезжает последним
		// обновлением стола (строка в логе), а окна «игра закончена» в этот момент
		// ещё нет — оно выходит только после анимации.
		await session.waitFor('Bob', (s) => s.gameLog.some((line) => line.includes('заживо сожжен')));
		const duringBurn = await session.snapshot('Bob');
		expect(duringBurn.notifications.some((n) => n.type === 'gameEnd')).toBe(false);

		await session.waitFor('Bob', (s) => s.notifications.some((n) => n.type === 'gameEnd'));
		const end = (await session.snapshot('Bob')).notifications.find((n) => n.type === 'gameEnd');
		expect(end?.text).toContain('не справился');

		// Последний кадр стола — тот, на котором стол и останется: обновлений
		// после конца партии не будет. Значит, сожжённое Нечто в рассадке не
		// сидит, и стрелка огнемёта от поджигателя к нему не висит над столом.
		const aliceId = await session.idOf('Alice');
		const final = await session.snapshot('Bob');
		expect(final.playersList).not.toContain(aliceId);
		expect(final.players[aliceId]?.turnState).toBe('dead');
		expect(final.tradeContext).toBe(null);
	});
});
