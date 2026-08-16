import {test, expect, Browser} from '@playwright/test';
import {GameSession, startGame, newPlayer} from './helpers/table';

// Правила сессии игрока (ник = человек):
//  • у одного человека не может быть двух комнат — повторное «Создай игру»
//    возвращает его в свою же;
//  • вход тем же ником ЗАМЕЩАЕТ старое подключение, а не отбивается ошибкой
//    «игрок ещё онлайн» — иначе после обрыва/рефреша в свою игру не вернуться.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

test.describe.serial('Сессия игрока: одна игра на человека и замещение', () => {
	test('повторное «Создай игру» тем же ником не плодит комнаты, а возвращает в свою', async ({browser}: {browser: Browser}) => {
		const alice = await newPlayer(browser, 'Alice');
		await alice.getByRole('button', {name: 'Создай игру'}).click();
		await expect(alice.getByRole('heading', {name: 'Лобби игры'})).toBeVisible();

		// Наблюдатель видит ровно одну комнату Alice с одним игроком.
		const watcher = await newPlayer(browser, 'Watcher');
		const roomButton = watcher.getByRole('button', {name: /Игра созданная Alice/});
		await expect(roomButton).toHaveCount(1);
		await expect(roomButton).toContainText('1 игрок');

		// Тот же человек с другого устройства снова жмёт «Создай игру»: попадает
		// в свою же комнату, второй не появляется и второго Alice в ней нет.
		const alice2 = await newPlayer(browser, 'Alice');
		await alice2.getByRole('button', {name: 'Создай игру'}).click();
		await expect(alice2.getByRole('heading', {name: 'Лобби игры'})).toBeVisible();
		await expect(alice2.getByText('Хост', {exact: false})).toBeVisible();

		await expect(watcher.getByRole('button', {name: /Игра созданная Alice/})).toHaveCount(1);
		await expect(roomButton).toContainText('1 игрок');

		// Старое подключение выкинуто в лаунчер — играет только новое.
		await expect(alice.getByPlaceholder('введи ник')).toBeVisible();

		for (const page of [alice, alice2, watcher]) await page.context().close();
	});

	test('вход тем же ником замещает старый инстанс игрока в начатой игре', async ({browser}: {browser: Browser}) => {
		const session: GameSession = await startGame(browser, NICKS);
		const bobId = await session.idOf('Bob');
		const oldBob = session.page('Bob');

		// Bob заходит заново с другого устройства, не разрывая старую сессию:
		// сервер обязан пустить его, а не ответить «игрок ещё онлайн».
		const newBob = await newPlayer(browser, 'Bob');
		const joinButton = newBob.getByRole('button', {name: /Игра созданная Alice/});
		await expect(joinButton).toBeVisible();
		await joinButton.click();
		await expect(newBob.locator('canvas')).toBeVisible({timeout: 20_000});
		await newBob.waitForFunction(() => {
			const gc = (window as unknown as {__resistance?: {currentPlayerId: string | null}}).__resistance;
			return !!gc && !!gc.currentPlayerId;
		});
		expect(await newBob.evaluate(() => (window as unknown as {__resistance: {currentPlayerId: string | null}}).__resistance.currentPlayerId)).toBe(bobId);

		// Старая вкладка Bob вернулась в лаунчер, а для остальных Bob всё это
		// время онлайн — «залипшего» офлайна после замещения быть не должно.
		await expect(oldBob.getByPlaceholder('введи ник')).toBeVisible();
		await session.waitFor('Alice', (s) => s.players[bobId]?.isConnected === true);

		await newBob.context().close();
		await session.close();
	});
});
