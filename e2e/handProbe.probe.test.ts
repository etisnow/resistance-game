import {test, expect, Browser, Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

// ВРЕМЕННЫЙ пробник (не часть набора): расступание соседей при наведении.

const SHOTS = '/tmp/claude-1000/-home-neer-projects-nechto/db899e23-f679-4471-8e80-e3d19e4a3d75/scratchpad/shots';
const HAND_CLIP = {x: 380, y: 380, width: 540, height: 340};

interface GcWindow {
	__nechto?: {playersList: string[]};
}

test('пробник: расступание соседей', async ({browser}: {browser: Browser}) => {
	const context = await browser.newContext();
	const page: Page = await context.newPage();
	try {
		await page.goto('/?withBots=true&seed=777&hand=tenacity-analysis-suspicion-barricade');
		await page.getByPlaceholder('введи ник').fill('Me');
		await page.getByRole('button', {name: 'Создай игру'}).click();
		await expect(page.locator('canvas')).toBeVisible({timeout: 20_000});
		await page.waitForFunction(() => {
			const c = (window as unknown as GcWindow).__nechto;
			return !!c && c.playersList.length === 5;
		});
		await page.waitForTimeout(1200);
		await page.screenshot({path: `${SHOTS}/spread-idle.png`});

		// Вторая карта веера.
		await page.mouse.move(592, 620);
		await page.waitForTimeout(1000);
		await page.screenshot({path: `${SHOTS}/spread-center.png`});

		// Крайняя карта.
		await page.mouse.move(300, 300);
		await page.waitForTimeout(400);
		await page.mouse.move(790, 620);
		await page.waitForTimeout(1000);
		await page.screenshot({path: `${SHOTS}/spread-edge.png`});

		// Стабильность у нижней кромки.
		await page.mouse.move(300, 300);
		await page.waitForTimeout(400);
		await page.mouse.move(592, 700);
		await page.waitForTimeout(1200);
		await page.screenshot({path: `${SHOTS}/spread-bottom-a.png`, clip: HAND_CLIP});
		await page.waitForTimeout(800);
		await page.screenshot({path: `${SHOTS}/spread-bottom-b.png`, clip: HAND_CLIP});
		expect(readFileSync(`${SHOTS}/spread-bottom-a.png`).equals(readFileSync(`${SHOTS}/spread-bottom-b.png`))).toBe(true);
	} finally {
		await page.context().close();
	}
});
