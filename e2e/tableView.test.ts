import {test, expect} from '@playwright/test';
import {startGame} from './helpers/nechto';

// Вид стола — настройка игрока в меню: по умолчанию стол абсолютный, у всех
// одинаковый, а «от первого лица» разворачивает его под смотрящего. Спрашивают
// её один раз: она переживает перезагрузку страницы.
test('вид стола переключается в меню и запоминается', async ({browser}) => {
	const nicks = ['Аня', 'Боря', 'Вера', 'Гена', 'Дима'];
	const session = await startGame(browser, nicks);
	const page = session.pages['Вера']!;

	expect(await page.evaluate(() => (window as any).__nechto.isFirstPersonTable)).toBe(false);

	await page.getByRole('button', {name: 'Меню'}).click();
	await page.getByRole('button', {name: 'Стол от первого лица'}).click();
	expect(await page.evaluate(() => (window as any).__nechto.isFirstPersonTable)).toBe(true);

	// Меню от переключения не закрывается: вид выбирают, глядя на стол.
	await expect(page.getByRole('button', {name: 'Вернуться к игре'})).toBeVisible();
	await page.getByRole('button', {name: 'Вернуться к игре'}).click();

	await page.reload();
	await page.waitForFunction(() => !!(window as any).__nechto);
	expect(await page.evaluate(() => (window as any).__nechto.isFirstPersonTable)).toBe(true);

	await session.close();
});

// Прицел ходящего наводится по turnPlayerId. Сервер присылал его с самого
// начала, но клиент до прицела им не пользовался — если поле опять перестанет
// доезжать, стол молча останется без индикатора хода.
test('стол знает, чей сейчас ход, и ведёт это поле за сменой хода', async ({browser}) => {
	const nicks = ['Аня', 'Боря', 'Вера', 'Гена'];
	const session = await startGame(browser, nicks);
	const page = session.pages['Вера']!;
	const turnNick = () => page.evaluate(() => {
		const gc = (window as any).__nechto;
		return gc.turnPlayerId ? gc.players[gc.turnPlayerId]?.nickname : null;
	});

	await session.arrange({players: nicks, turn: 'Аня', hands: {'Аня': ['analysis']}});
	expect(await turnNick()).toBe('Аня');

	await session.arrange({players: nicks, turn: 'Боря', hands: {'Боря': ['analysis']}});
	expect(await turnNick()).toBe('Боря');

	await session.close();
});
