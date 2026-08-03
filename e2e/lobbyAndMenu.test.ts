import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, newPlayer, fill} from './helpers/nechto';

// UX вокруг лаунчера и стола:
//  • в списке комнат видно, сколько там игроков, и счётчик живой;
//  • после конца игры уведомление можно скрыть и всё равно выйти — через меню стола;
//  • список комнат в лаунчере не залипает: у вышедшего игрока закончившейся
//    комнаты в списке уже нет.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Лаунчер и меню стола', () => {
	test('в списке комнат видно количество игроков и оно обновляется', async ({browser}: {browser: Browser}) => {
		const alice = await newPlayer(browser, 'Alice');
		await alice.getByRole('button', {name: 'Создай игру'}).click();
		await expect(alice.getByRole('heading', {name: 'Лобби игры'})).toBeVisible();

		// Наблюдатель в лаунчере видит комнату с одним игроком.
		const watcher = await newPlayer(browser, 'Watcher');
		const roomButton = watcher.getByRole('button', {name: /Игра созданная Alice/});
		await expect(roomButton).toContainText('1 игрок');

		// Присоединение второго игрока обновляет счётчик у наблюдателя без перезагрузки.
		const bob = await newPlayer(browser, 'Bob');
		await bob.getByRole('button', {name: /Игра созданная Alice/}).click();
		await expect(bob.getByRole('heading', {name: 'Лобби игры'})).toBeVisible();
		await expect(roomButton).toContainText('2 игрока');

		// Хост вышел — комната распалась и из списка пропала.
		await alice.getByText('← назад').click();
		await expect(alice.getByRole('heading', {name: 'Вход'})).toBeVisible();
		await expect(roomButton).toHaveCount(0);

		for (const page of [alice, bob, watcher]) await page.context().close();
	});

	test('после конца игры «Скрыть» не запирает игрока на столе', async ({browser}: {browser: Browser}) => {
		const session: GameSession = await startGame(browser, NICKS);

		// Bob сжигает Нечто (Alice) — игра заканчивается победой людей.
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
		// У Alice нет «Никакого шашлыка» — сервер сжигает её сам.
		await session.waitFor('Bob', (s) => s.notifications.some((n) => n.type === 'gameEnd'));

		const bob = session.page('Bob');
		// Скрываем итог, чтобы дочитать лог: кнопки выхода из уведомления больше нет.
		await bob.getByText('Скрыть').click();
		await expect(bob.getByText('Скрыть')).toHaveCount(0);

		// Выход остаётся доступен через меню стола.
		await bob.getByRole('button', {name: 'Меню'}).click();
		await bob.getByRole('button', {name: 'Выйти в лобби'}).click();
		await expect(bob.getByRole('heading', {name: 'Вход'})).toBeVisible();

		// И список комнат у вышедшего свежий: закончившейся игры в нём нет.
		await expect(bob.getByRole('button', {name: /Игра созданная Alice/})).toHaveCount(0);

		await session.close();
	});
});
