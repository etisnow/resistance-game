import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, newPlayer} from './helpers/table';

// UX вокруг лаунчера и стола:
//  • громкости крутятся ещё до партии, прямо на входе;
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
	// Музыка играет с первой секунды, ещё до всякой партии, — значит и убавить её
	// можно, не садясь за стол.
	test('меню с громкостями открывается на входе', async ({browser}: {browser: Browser}) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		await page.goto('/');
		await expect(page.getByPlaceholder('введи ник')).toBeVisible();

		await page.getByRole('button', {name: 'Меню'}).click();
		await expect(page.getByText('Звуки')).toBeVisible();
		await expect(page.getByText('Музыка')).toBeVisible();

		// Щелчок мимо панели закрывает меню — как и за столом.
		await page.mouse.click(20, 20);
		await expect(page.getByRole('button', {name: 'Меню'})).toBeVisible();

		await context.close();
	});

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

		// В самом лобби игроки пронумерованы по порядку, в котором садились: пятерых
		// собирают на глаз, и считать их по головам не должно быть работой.
		await expect(bob.locator('.player-lobby-item').first()).toContainText('1. Alice');
		await expect(bob.locator('.player-lobby-item').nth(1)).toContainText('2. Bob');

		// Хост вышел — комната распалась и из списка пропала.
		await alice.getByText('← назад').click();
		await expect(alice.getByPlaceholder('введи ник')).toBeVisible();
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
		await expect(bob.getByPlaceholder('введи ник')).toBeVisible();

		await session.close();
	});
});
