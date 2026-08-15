import {test, expect, Browser, Page} from '@playwright/test';

// Канвас стола должен всегда совпадать с окном: и по размеру бэкбуфера, и по
// плотности пикселей. Раньше он создавался один раз по размеру первого кадра, а
// дальше CSS растягивал его — сцена ехала с чужим соотношением сторон.

interface GcWindow {
	__resistance?: {playersList: string[]};
	__glContexts?: number;
}

const canvasMetrics = (page: Page) =>
	page.evaluate(() => {
		const canvas = document.querySelector('canvas') as HTMLCanvasElement;
		const host = document.querySelector('.pixi-stage') as HTMLElement;
		const rect = canvas.getBoundingClientRect();
		const hostRect = host.getBoundingClientRect();
		return {
			dpr: window.devicePixelRatio,
			backbuffer: {width: canvas.width, height: canvas.height},
			css: {width: Math.round(rect.width), height: Math.round(rect.height)},
			host: {width: Math.round(hostRect.width), height: Math.round(hostRect.height)},
			glContexts: (window as unknown as GcWindow).__glContexts ?? 0,
		};
	});

const startBotGame = async (browser: Browser, viewport: {width: number; height: number}, deviceScaleFactor = 1) => {
	const context = await browser.newContext({viewport, deviceScaleFactor});
	const page = await context.newPage();
	// Считаем создания WebGL-контекста: пересоздание приложения PIXI (а именно
	// это делал <Stage>, когда ему меняли options/width/height) видно только так.
	await page.addInitScript(() => {
		const original = HTMLCanvasElement.prototype.getContext;
		(window as unknown as GcWindow).__glContexts = 0;
		HTMLCanvasElement.prototype.getContext = function patched(this: HTMLCanvasElement, ...args: unknown[]) {
			const type = String(args[0]);
			if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
				const counters = window as unknown as GcWindow;
				counters.__glContexts = (counters.__glContexts ?? 0) + 1;
			}
			return (original as (...a: unknown[]) => unknown).apply(this, args);
		} as typeof HTMLCanvasElement.prototype.getContext;
	});
	// botCount фиксируем: тест про раскладку канваса, а не про число ботов, и он
	// не должен ломаться при смене дефолта дев-режима.
	await page.goto('/?withBots=true&botCount=4');
	await page.getByPlaceholder('введи ник').fill('Me');
	await page.getByRole('button', {name: 'Создай игру'}).click();
	await expect(page.locator('canvas')).toBeVisible({timeout: 20_000});
	await page.waitForFunction(() => {
		const gc = (window as unknown as GcWindow).__resistance;
		return !!gc && gc.playersList.length === 5;
	});
	return {context, page};
};

test('канвас следует за окном при ресайзе', async ({browser}) => {
	const {context, page} = await startBotGame(browser, {width: 1400, height: 900});
	// Стартовое число контекстов включает пробы поддержки WebGL (isWebGLAvailable
	// и проверка внутри pixi) — важно, что при ресайзе оно не растёт.
	const initial = await canvasMetrics(page);

	const sizes = [
		{width: 1900, height: 700},
		{width: 420, height: 880},
		{width: 880, height: 420},
		{width: 1200, height: 1000},
	];
	for (const size of sizes) {
		await page.setViewportSize(size);
		await page.waitForTimeout(600);
		const metrics = await canvasMetrics(page);
		const label = `${size.width}x${size.height}`;
		// CSS-размер канваса — это размер области стола...
		expect(metrics.css, label).toEqual(metrics.host);
		expect(metrics.host, label).toEqual(size);
		// ...а бэкбуфер — он же, умноженный на плотность экрана. Если эти два
		// расходятся, картинка растягивается и соотношение сторон плывёт.
		expect(metrics.backbuffer, label).toEqual({
			width: Math.round(size.width * metrics.dpr),
			height: Math.round(size.height * metrics.dpr),
		});
		// Ресайз меняет размер существующего рендерера, а не создаёт новый.
		expect(metrics.glContexts, label).toBe(initial.glContexts);
	}
	await context.close();
});

test('на HiDPI бэкбуфер учитывает плотность экрана', async ({browser}) => {
	const {context, page} = await startBotGame(browser, {width: 900, height: 760}, 2);
	const initial = await canvasMetrics(page);
	expect(initial).toMatchObject({
		dpr: 2,
		backbuffer: {width: 1800, height: 1520},
		css: {width: 900, height: 760},
	});

	await page.setViewportSize({width: 1200, height: 640});
	await page.waitForTimeout(600);
	expect(await canvasMetrics(page)).toMatchObject({
		backbuffer: {width: 2400, height: 1280},
		css: {width: 1200, height: 640},
		glContexts: initial.glContexts,
	});
	await context.close();
});
