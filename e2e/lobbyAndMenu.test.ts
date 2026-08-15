import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, newPlayer} from './helpers/table';

// UX вокруг лаунчера и стола:
//  • в списке комнат видно, сколько там игроков, и счётчик живой;
//  • со стола можно выйти через меню, и выход из живой партии спрашивает
//    подтверждение;
//  • список комнат в лаунчере не залипает: у вышедшего игрока распавшейся
//    комнаты в списке уже нет.
//
// TODO (фаза 3): вернуть проверку «после конца игры „Скрыть“ не запирает игрока
// на столе» — для неё нужна доигранная партия.

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

	test('со стола выходят через меню, и живая партия спрашивает подтверждение', async ({browser}: {browser: Browser}) => {
		const session: GameSession = await startGame(browser, NICKS);
		const bob = session.page('Bob');

		await bob.getByRole('button', {name: 'Меню'}).click();
		// Выход из идущей партии разваливает стол остальным, поэтому первое
		// нажатие только переспрашивает.
		await bob.getByRole('button', {name: 'Выйти в лобби'}).click();
		await expect(bob.getByRole('button', {name: 'Точно выйти? Нажми ещё раз'})).toBeVisible();
		await bob.getByRole('button', {name: 'Точно выйти? Нажми ещё раз'}).click();
		await expect(bob.getByRole('heading', {name: 'Вход'})).toBeVisible();

		await session.close();
	});
});
