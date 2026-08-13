import {describe, expect, test, beforeAll} from 'bun:test';
import {map, range} from 'lodash';

// Геометрия стола считается от размеров окна, поэтому перед импортом хелперов
// подсовываем минимальный window (см. roomLayout.test).
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
let roomPlayerAngle: typeof import('client/helpers/roomHelpers').roomPlayerAngle;
let roomPlayerPoint: typeof import('client/helpers/roomHelpers').roomPlayerPoint;
let playerRoomDiag: typeof import('client/helpers/roomHelpers').playerRoomDiag;
let badgeAspect: number;
let arrowPath: typeof import('client/helpers/arrowPath').arrowPath;
let isTightPair: typeof import('client/helpers/arrowPath').isTightPair;
let tableField: typeof import('client/helpers/window').tableField;
let roomLift: typeof import("client/helpers/window").roomLift;

beforeAll(async () => {
	({viewport} = await import('client/helpers/viewport'));
	({roomRadii, roomPlayerAngle, roomPlayerPoint, playerRoomDiag, badgeAspect} = await import('client/helpers/roomHelpers'));
	({arrowPath, isTightPair} = await import('client/helpers/arrowPath'));
	({tableField, roomLift} = await import("client/helpers/window"));
});

const resize = (width: number, height: number) => {
	fakeWindow.innerWidth = width;
	fakeWindow.innerHeight = height;
	viewport.measure();
};

const screens = [
	{name: 'desktop 1920x1080', width: 1920, height: 1080},
	{name: 'desktop 1492x1046', width: 1492, height: 1046},
	{name: 'laptop 1366x768', width: 1366, height: 768},
	{name: 'ultrawide 2560x1080', width: 2560, height: 1080},
	{name: 'ipad 820x1180', width: 820, height: 1180},
	{name: 'iphone 390x844', width: 390, height: 844},
];

const counts = [4, 5, 6, 8, 10, 12];

const seatsOf = (count: number) => map(range(count), String);

// Радиус значка действия на стрелке — тот же, что рисует стол (tradeIconShare).
const iconShare = 0.42;

const pathBetween = (count: number, fromSeat: number, toSeat: number) => {
	const seats = seatsOf(count);
	const from = String(fromSeat);
	const to = String(toSeat);
	const step = Math.abs(fromSeat - toSeat);
	return arrowPath({
		from: roomPlayerPoint(from, seats),
		to: roomPlayerPoint(to, seats),
		fromAngle: roomPlayerAngle(from, seats),
		toAngle: roomPlayerAngle(to, seats),
		isNeighbours: step === 1 || step === count - 1,
		badgeRadius: playerRoomDiag(count) / 2,
		seatRadii: roomRadii(count),
		iconRadius: (playerRoomDiag(count) / 2) * iconShare,
	});
};

const tightBetween = (count: number, fromSeat: number, toSeat: number) => {
	const seats = seatsOf(count);
	const step = Math.abs(fromSeat - toSeat);
	return isTightPair({
		from: roomPlayerPoint(String(fromSeat), seats),
		to: roomPlayerPoint(String(toSeat), seats),
		fromAngle: roomPlayerAngle(String(fromSeat), seats),
		toAngle: roomPlayerAngle(String(toSeat), seats),
		isNeighbours: step === 1 || step === count - 1,
		badgeRadius: playerRoomDiag(count) / 2,
		seatRadii: roomRadii(count),
		iconRadius: (playerRoomDiag(count) / 2) * iconShare,
	});
};

// Точка кубической кривой: ею проверяем, что путь и правда проходит там, где
// стол рисует значок действия.
const cubicAt = (t: number, a: number, c1: number, c2: number, b: number): number => {
	const u = 1 - t;
	return u * u * u * a + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * b;
};

// Насколько точка далека от кружка игрока в его же мерке: 1 — ровно на кромке,
// больше — снаружи. Кружок вытянут вверх (badgeAspect), поэтому мерка эллипсом.
const badgeReach = (point: {x: number; y: number}, badge: {x: number; y: number}, badgeRadius: number): number =>
	Math.hypot((point.x - badge.x) / badgeRadius, (point.y - badge.y) / (badgeRadius * badgeAspect));

describe('путь стрелки', () => {
	for (const screen of screens) {
		for (const count of counts) {
			const label = `${screen.name}, ${count} игроков`;

			test(`${label}: значок действия сидит ровно на пути`, () => {
				resize(screen.width, screen.height);
				for (const seat of range(count)) {
					const path = pathBetween(count, seat, (seat + 1) % count);
					expect(cubicAt(0.5, path.ax, path.mid1X, path.mid2X, path.bx)).toBeCloseTo(path.midX, 6);
					expect(cubicAt(0.5, path.ay, path.mid1Y, path.mid2Y, path.by)).toBeCloseTo(path.midY, 6);
				}
			});

			test(`${label}: наконечник упирается в кружок цели и смотрит в него`, () => {
				resize(screen.width, screen.height);
				const seats = seatsOf(count);
				const badgeRadius = playerRoomDiag(count) / 2;
				for (const seat of range(count)) {
					const targetSeat = (seat + 1) % count;
					const target = roomPlayerPoint(String(targetSeat), seats);
					const path = pathBetween(count, seat, targetSeat);
					// Остриё стоит у самой кромки кружка — не в нём и не поодаль.
					const reach = Math.hypot(path.arrowX - target.x, path.arrowY - target.y);
					expect(reach).toBeGreaterThan(badgeRadius);
					expect(reach).toBeLessThan(badgeRadius + 12);
					// Наконечник — треугольник, растущий из острия назад по ходу
					// стрелки (см. Arrow): значит, ход должен вести в кружок цели.
					const heading = path.arrowRotation - 90;
					const toBadge = (Math.atan2(target.y - path.arrowY, target.x - path.arrowX) * 180) / Math.PI;
					const off = Math.abs(((((heading - toBadge) % 360) + 540) % 360) - 180);
					expect(off).toBeLessThan(1);
				}
			});

			test(`${label}: тесным соседям путь идёт в обход, мимо обоих кружков`, () => {
				resize(screen.width, screen.height);
				const seats = seatsOf(count);
				const badgeRadius = playerRoomDiag(count) / 2;
				for (const seat of range(count)) {
					const targetSeat = (seat + 1) % count;
					if (!tightBetween(count, seat, targetSeat)) continue;
					const path = pathBetween(count, seat, targetSeat);
					const apex = {x: path.midX, y: path.midY};
					// Значок действия — на чистом столе: он не должен налезать ни на
					// кого из сидящих, а не только на этих двоих.
					for (const playerId of seats) {
						expect(badgeReach(apex, roomPlayerPoint(playerId, seats), badgeRadius)).toBeGreaterThan(1);
					}
					// Обход и правда обход: путь длиннее прямой между его же концами.
					const detour = Math.hypot(apex.x - path.ax, apex.y - path.ay)
						+ Math.hypot(path.bx - apex.x, path.by - apex.y);
					const direct = Math.hypot(path.bx - path.ax, path.by - path.ay);
					expect(detour).toBeGreaterThan(direct);
					// И ради этого всё затевалось: видно его больше, чем было видно
					// прямой стрелки — той доставался один просвет между кружками.
					const from = roomPlayerPoint(String(seat), seats);
					const to = roomPlayerPoint(String(targetSeat), seats);
					const gap = Math.hypot(to.x - from.x, to.y - from.y) - 2 * (badgeRadius + 5);
					expect(detour).toBeGreaterThan(gap);
					// Обход идёт наружу от стола, и вылететь за поле ему нельзя: значок
					// на вершине должен остаться на виду целиком. Поле отмеряется от
					// середины комнаты, а она поднята над серединой поля (roomLift):
					// сверху места на столько меньше, снизу на столько же больше.
					const icon = badgeRadius * iconShare;
					const field = tableField();
					expect(Math.abs(apex.x) + icon).toBeLessThanOrEqual(field.width / 2);
					const room = roomLift();
					const up = field.height / 2 - room;
					const down = field.height / 2 + room;
					expect(apex.y < 0 ? -apex.y + icon : apex.y + icon).toBeLessThanOrEqual(apex.y < 0 ? up : down);
				}
			});
		}
	}

	test('вчетвером соседи сидят просторно — стрелка между ними прямая', () => {
		resize(1492, 1046);
		expect(tightBetween(4, 0, 1)).toBe(false);
		const path = pathBetween(4, 0, 1);
		const seats = seatsOf(4);
		const from = roomPlayerPoint('0', seats);
		const to = roomPlayerPoint('1', seats);
		// Прямой путь идёт серединой между кружками, а не в обход.
		expect(path.midX).toBeCloseTo((path.ax + path.bx) / 2, 6);
		expect(path.midY).toBeCloseTo((path.ay + path.by) / 2, 6);
		const along = Math.abs(
			(to.x - from.x) * (path.midY - from.y) - (to.y - from.y) * (path.midX - from.x),
		) / Math.hypot(to.x - from.x, to.y - from.y);
		expect(along).toBeLessThan(1);
	});

	test('за полным столом соседям тесно — стрелка идёт дугой', () => {
		resize(1492, 1046);
		expect(tightBetween(12, 0, 1)).toBe(true);
		// А через одного — уже не соседи: там сидит третий, и обходить его нельзя.
		expect(tightBetween(12, 0, 2)).toBe(false);
	});
});
