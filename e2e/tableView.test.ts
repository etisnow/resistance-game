import {test, expect} from '@playwright/test';
import {startGame} from './helpers/table';

// Вид стола — настройка игрока в меню: по умолчанию стол абсолютный, у всех
// одинаковый, а «от первого лица» разворачивает его под смотрящего. Спрашивают
// её один раз: она переживает перезагрузку страницы.
test('вид стола переключается в меню и запоминается', async ({browser}) => {
	const nicks = ['Аня', 'Боря', 'Вера', 'Гена', 'Дима'];
	const session = await startGame(browser, nicks);
	const page = session.pages['Вера']!;

	expect(await page.evaluate(() => (window as any).__resistance.isFirstPersonTable)).toBe(false);

	await page.getByRole('button', {name: 'Меню'}).click();
	await page.getByRole('button', {name: 'Стол от первого лица'}).click();
	expect(await page.evaluate(() => (window as any).__resistance.isFirstPersonTable)).toBe(true);

	// Меню от переключения не закрывается: вид выбирают, глядя на стол.
	await expect(page.getByRole('button', {name: 'Вернуться к игре'})).toBeVisible();
	await page.getByRole('button', {name: 'Вернуться к игре'}).click();

	await page.reload();
	await page.waitForFunction(() => !!(window as any).__resistance);
	expect(await page.evaluate(() => (window as any).__resistance.isFirstPersonTable)).toBe(true);

	await session.close();
});

// Прицел ходящего наводится по turnPlayerId. Если поле перестанет доезжать,
// стол молча останется без индикатора хода.
//
// TODO (фаза 2): проверять, что прицел едет за сменой лидера, — сейчас смены
// хода в игре ещё нет.
test('стол знает, чей сейчас ход', async ({browser}) => {
	const nicks = ['Аня', 'Боря', 'Вера', 'Гена', 'Дима'];
	const session = await startGame(browser, nicks);
	const page = session.pages['Вера']!;
	const turnNick = () => page.evaluate(() => {
		const gc = (window as any).__resistance;
		return gc.turnPlayerId ? gc.players[gc.turnPlayerId]?.nickname : null;
	});

	expect(nicks).toContain(await turnNick());

	await session.close();
});
