import {test, expect, Browser, Page} from '@playwright/test';
import {GameSession, startGame, fill} from './helpers/nechto';

// Названия карт в игровом логе — интерактивные: по наведению (или тапу на
// тач-экране) рядом со словом всплывает сама карта, достаточно крупная, чтобы
// прочитать её текст. Всплывашка универсальная (HoverHint), здесь проверяем её
// на логе — единственном месте, где она пока используется.

const NICKS = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin'];

// Лог уходит под канвас, пока висят уведомления (см. getZIndex), а свёрнутым он
// показывает только последнюю строку. Приводим страницу в состояние «лог открыт
// и кликабелен» и ждём саму строку про карантин.
const openLog = async (page: Page): Promise<void> => {
	await page.evaluate(() => {
		const gc = (window as unknown as {__nechto: {
			notifications: unknown[];
			isGameLogOpen: boolean;
			hidENotificationAction(): void;
			toggleGameLog(): void;
		}}).__nechto;
		while (gc.notifications.length) gc.hidENotificationAction();
		if (!gc.isGameLogOpen) gc.toggleGameLog();
	});
	await expect(page.locator('.gameLogList')).toBeVisible();
};

test.describe.serial('Подсказки карт в игровом логе', () => {
	let session: GameSession;
	test.beforeAll(async ({browser}: {browser: Browser}) => {
		session = await startGame(browser, NICKS);
	});
	test.afterAll(async () => {
		await session.close();
	});

	test('название карты в строке лога показывает саму карту', async () => {
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			hands: {Alice: fill(['quarantine']), Bob: fill([], 4)},
		});
		await session.play('Alice', 'quarantine');
		await session.selectPlayer('Alice', 'Bob');
		await session.waitFor('Alice', (s) => s.gameLog.some((l) => l.includes('на карантине')));

		const page = session.page('Alice');
		await openLog(page);

		// Слово «карантине» в строке лога — якорь подсказки.
		const mention = page.locator('.gameLogList .cardMention', {hasText: 'карантине'}).first();
		await expect(mention).toBeVisible();

		// На десктопе окошко живёт по наведению.
		await mention.hover();
		const card = page.locator('[data-hint-popup] [data-card-hint="quarantine"]');
		await expect(card).toBeVisible();
		// Карту должно быть видно целиком и крупно — иначе её текст не прочитать.
		const box = await card.boundingBox();
		const viewport = page.viewportSize();
		expect(box).not.toBeNull();
		expect(viewport).not.toBeNull();
		expect(box!.height).toBeGreaterThan(viewport!.height * 0.25);
		expect(box!.x).toBeGreaterThanOrEqual(0);
		expect(box!.y).toBeGreaterThanOrEqual(0);
		expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
		expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);

		// Увели курсор — подсказка ушла.
		await page.mouse.move(1, viewport!.height - 1);
		await expect(page.locator('[data-hint-popup]')).toHaveCount(0);
	});

	test('клик прикалывает окошко, крестик его закрывает, лог не сворачивается', async () => {
		const page = session.page('Alice');
		await openLog(page);
		const mention = page.locator('.gameLogList .cardMention', {hasText: 'карантине'}).first();

		// Тап (на мобиле наведения нет) — окошко остаётся висеть само по себе.
		await mention.click();
		await expect(page.locator('[data-hint-popup] [data-card-hint="quarantine"]')).toBeVisible();
		const viewport = page.viewportSize()!;
		await page.mouse.move(1, viewport.height - 1);
		await expect(page.locator('[data-hint-popup]')).toHaveCount(1);

		// Закрывается крестиком.
		await page.locator('[data-hint-close]').click();
		await expect(page.locator('[data-hint-popup]')).toHaveCount(0);

		// Клик по слову не должен доходить до шапки лога и сворачивать его.
		const isLogOpen = await page.evaluate(
			() => (window as unknown as {__nechto: {isGameLogOpen: boolean}}).__nechto.isGameLogOpen,
		);
		expect(isLogOpen).toBe(true);
	});

	test('свёрнутый лог: подсказка работает и в шапке', async () => {
		// Свёрнутый лог показывает только последнюю строку — берём сценарий, где
		// последней ложится строка паники с названиями карт.
		await session.arrange({
			players: NICKS,
			turn: 'Alice',
			turnState: 'inCardPick',
			hands: {Alice: fill([], 4)},
			deck: ['oldRopes', 'analysis', 'analysis'],
		});
		await session.cardPick('Alice');
		await session.waitFor('Alice', (s) => s.gameLog.some((l) => l.includes('старые веревки')));

		const page = session.page('Alice');
		await openLog(page);
		await page.evaluate(
			() => (window as unknown as {__nechto: {toggleGameLog(): void}}).__nechto.toggleGameLog(),
		);
		await expect(page.locator('.gameLogList')).toHaveCount(0);

		const mention = page.locator('.gameLogPreview .cardMention').first();
		await expect(mention).toBeVisible();
		await mention.click();
		await expect(page.locator('[data-hint-popup]')).toHaveCount(1);

		// Тап мимо — по «стене» под окошком — тоже закрывает.
		await page.locator('[data-hint-backdrop]').click({position: {x: 5, y: 5}});
		await expect(page.locator('[data-hint-popup]')).toHaveCount(0);
		// И лог как был свёрнут, так и остался.
		const isLogOpen = await page.evaluate(
			() => (window as unknown as {__nechto: {isGameLogOpen: boolean}}).__nechto.isGameLogOpen,
		);
		expect(isLogOpen).toBe(false);
	});
});
