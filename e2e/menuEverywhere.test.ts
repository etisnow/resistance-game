import {test, expect} from '@playwright/test';
import {newPlayer, startGame} from './helpers/table';

// Кнопка меню нужна на любом экране: громкость крутят когда угодно, а не только
// сев за стол. В лобби её однажды уже забыли — экраны разные, и меню на них два
// (короткое в App и своё за столом).
test('меню есть на всех экранах', async ({browser}) => {
	const host = await newPlayer(browser, 'Аня');
	// Вход.
	await expect(host.getByRole('button', {name: 'Меню'})).toBeVisible();

	// Лобби.
	await host.getByRole('button', {name: 'Создай игру'}).click();
	await expect(host.getByRole('heading', {name: 'Лобби игры'})).toBeVisible();
	await host.getByRole('button', {name: 'Меню'}).click();
	await expect(host.getByText('Звуки')).toBeVisible();
	await expect(host.getByText('Музыка')).toBeVisible();
	await host.context().close();

	// Стол: там меню своё, с выходом и видом стола.
	const session = await startGame(browser, ['Аня', 'Боря', 'Вера', 'Гена', 'Дима']);
	const bob = session.page('Боря');
	await bob.getByRole('button', {name: 'Меню'}).click();
	await expect(bob.getByRole('button', {name: 'Выйти в лобби'})).toBeVisible();
	await session.close();
});
