import {describe, expect, test, beforeAll} from 'bun:test';

// Геометрия стола считается от размеров окна, поэтому перед импортом хелперов
// подсовываем минимальный window: viewport читает его прямо в конструкторе.
const fakeWindow = {
	innerWidth: 1280,
	innerHeight: 720,
	devicePixelRatio: 1,
	addEventListener: () => {},
	removeEventListener: () => {},
	requestAnimationFrame: () => 0,
	cancelAnimationFrame: () => {},
};
(globalThis as unknown as {window: typeof fakeWindow}).window = fakeWindow;

let viewport: typeof import('client/helpers/viewport').viewport;
let roomRadii: typeof import('client/helpers/roomHelpers').roomRadii;
let playerRoomDiag: typeof import('client/helpers/roomHelpers').playerRoomDiag;
let tableField: typeof import('client/helpers/window').tableField;
let tableCenterY: typeof import('client/helpers/window').tableCenterY;

beforeAll(async () => {
	({viewport} = await import('client/helpers/viewport'));
	({roomRadii, playerRoomDiag} = await import('client/helpers/roomHelpers'));
	({tableField, tableCenterY} = await import('client/helpers/window'));
});

const resize = (width: number, height: number) => {
	fakeWindow.innerWidth = width;
	fakeWindow.innerHeight = height;
	viewport.measure();
};

// Ходовые форматы: десктоп, ультравайд, ноутбук, планшет, телефоны в обеих
// ориентациях и совсем маленький экран.
const screens = [
	{name: 'desktop 1920x1080', width: 1920, height: 1080},
	{name: 'desktop 1492x1046', width: 1492, height: 1046},
	{name: 'laptop 1366x768', width: 1366, height: 768},
	{name: 'ultrawide 2560x1080', width: 2560, height: 1080},
	{name: 'ipad 820x1180', width: 820, height: 1180},
	{name: 'phone 563x1020', width: 563, height: 1020},
	{name: 'iphone 390x844', width: 390, height: 844},
	{name: 'small phone 320x568', width: 320, height: 568},
	{name: 'phone landscape 844x390', width: 844, height: 390},
];

const counts = [4, 5, 6, 8, 10, 12];

describe('геометрия стола', () => {
	for (const screen of screens) {
		for (const count of counts) {
			const label = `${screen.name}, ${count} игроков`;

			test(`${label}: стол круглый, бейджи крупные и не наезжают`, () => {
				resize(screen.width, screen.height);
				const badge = playerRoomDiag(count);
				const {rx, ry} = roomRadii(count);
				const field = tableField();

				// Стол должен читаться как круг, а не как вытянутый эллипс.
				expect(Math.max(rx, ry) / Math.min(rx, ry)).toBeLessThanOrEqual(1.21);

				// Бейдж — палец, а не точка: 40 px это минимум для тача. Двенадцать
				// игроков на телефоне в ландшафте — вырожденный случай: кольцо там
				// высотой в 180 px, и крупнее бейджи просто не разложить.
				expect(badge).toBeGreaterThanOrEqual(count > 10 && screen.height < 400 ? 34 : 40);

				// Соседние бейджи не перекрываются: расстояние между центрами
				// считаем по малой полуоси — там игроки сидят теснее всего.
				const step = 2 * Math.min(rx, ry) * Math.sin(Math.PI / count);
				expect(step).toBeGreaterThanOrEqual(badge);

				// Стол вместе с бейджами влезает в свободное поле.
				expect(rx + badge / 2).toBeLessThanOrEqual(field.width / 2);
				expect(ry + badge / 2).toBeLessThanOrEqual(field.height / 2 + 0.001);

				// И не залезает ни под лог сверху, ни под руку снизу.
				const center = tableCenterY();
				expect(center - ry - badge / 2).toBeGreaterThanOrEqual(field.top);
				expect(center + ry + badge / 2).toBeLessThanOrEqual(field.bottom + 0.001);
			});
		}
	}

	test('бейджи растут вместе с экраном', () => {
		resize(390, 844);
		const phone = playerRoomDiag(5);
		resize(1492, 1046);
		const desktop = playerRoomDiag(5);
		expect(phone).toBeGreaterThan(85);
		expect(desktop).toBeGreaterThan(phone);
	});

	test('чем больше игроков, тем мельче бейдж', () => {
		resize(1492, 1046);
		expect(playerRoomDiag(12)).toBeLessThan(playerRoomDiag(5));
	});
});
