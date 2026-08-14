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
let roomPlayerPoint: typeof import('client/helpers/roomHelpers').roomPlayerPoint;
let playerRoomDiag: typeof import('client/helpers/roomHelpers').playerRoomDiag;
let badgeAspect: number;
let arrowPath: typeof import('client/helpers/arrowPath').arrowPath;
let isTightPair: typeof import('client/helpers/arrowPath').isTightPair;
let tableField: typeof import('client/helpers/window').tableField;
let roomLift: typeof import("client/helpers/window").roomLift;

beforeAll(async () => {
	({viewport} = await import('client/helpers/viewport'));
	({roomPlayerPoint, playerRoomDiag, badgeAspect} = await import('client/helpers/roomHelpers'));
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
const iconShare = 0.3;

const argsBetween = (count: number, fromSeat: number, toSeat: number) => {
	const seats = seatsOf(count);
	const step = Math.abs(fromSeat - toSeat);
	return {
		from: roomPlayerPoint(String(fromSeat), seats),
		to: roomPlayerPoint(String(toSeat), seats),
		isNeighbours: step === 1 || step === count - 1,
		badgeRadius: playerRoomDiag(count) / 2,
		iconRadius: (playerRoomDiag(count) / 2) * iconShare,
	};
};

const pathBetween = (count: number, fromSeat: number, toSeat: number) =>
	arrowPath(argsBetween(count, fromSeat, toSeat));

const tightBetween = (count: number, fromSeat: number, toSeat: number) =>
	isTightPair(argsBetween(count, fromSeat, toSeat));

// Точка кубической кривой: ею проверяем, что путь и правда проходит там, где
// стол рисует значок действия.
const cubicAt = (t: number, a: number, c1: number, c2: number, b: number): number => {
	const u = 1 - t;
	return u * u * u * a + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * b;
};

// Расхождение двух направлений, в градусах: 0 — смотрят одинаково.
const angleGap = (deg: number, other: number): number =>
	Math.abs(((((deg - other) % 360) + 540) % 360) - 180);

// Куда от острия наконечника лежит точка, в градусах.
const degTo = (path: {arrowX: number; arrowY: number}, target: {x: number; y: number}): number =>
	(Math.atan2(target.y - path.arrowY, target.x - path.arrowX) * 180) / Math.PI;

type IArrowGeometry = ReturnType<typeof import('client/helpers/arrowPath').arrowPath>;
type IPoint = {x: number; y: number};

// Где точка стоит на отрезке между кружками: 0 — у одного, 1 — у другого, 0.5 —
// ровно посередине. Считается вдоль отрезка, поперёк он не важен.
const alongChord = (point: IPoint, from: IPoint, to: IPoint): number => {
	const chord = Math.hypot(to.x - from.x, to.y - from.y);
	return ((point.x - from.x) * (to.x - from.x) + (point.y - from.y) * (to.y - from.y)) / (chord * chord);
};

// Точки пути: по ним меряем всё, что должно лежать на самой линии.
const pathPoints = (path: IArrowGeometry): IPoint[] => map(range(1001), (step) => ({
	x: cubicAt(step / 1000, path.ax, path.mid1X, path.mid2X, path.bx),
	y: cubicAt(step / 1000, path.ay, path.mid1Y, path.mid2Y, path.by),
}));

// Насколько точка отстоит от линии пути.
const offPath = (path: IArrowGeometry, point: IPoint): number =>
	Math.min(...map(pathPoints(path), (at) => Math.hypot(at.x - point.x, at.y - point.y)));

// На какую долю отрезка между кружками приходится макушка пути — самая дальняя
// от отрезка его точка. У ровной дуги это ровно его середина.
const peakAlong = (path: IArrowGeometry, from: IPoint, to: IPoint): number => {
	const chord = Math.hypot(to.x - from.x, to.y - from.y);
	let peak = -1;
	let at = 0;
	for (const point of pathPoints(path)) {
		const off = Math.abs((to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x)) / chord;
		if (off > peak) {
			peak = off;
			at = alongChord(point, from, to);
		}
	}
	return at;
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
					// Не «где-то рядом»: значок кружком в полрадиуса бейджа, и сойди он
					// с линии хоть на пиксель — это видно.
					expect(offPath(path, {x: path.midX, y: path.midY})).toBeLessThan(0.5);
				}
			});

			test(`${label}: наконечник продолжает линию и упирается в кружок цели`, () => {
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
					// стрелки (см. Arrow). Ход у него тот же, каким линия приходит в
					// свой конец, — иначе треугольник сидит на ней свёрнутым набок.
					// Касательную в конце кубической кривой задаёт её последняя
					// опорная точка: путь идёт из неё в конец.
					const heading = path.arrowRotation - 90;
					const tangent = (Math.atan2(path.by - path.mid2Y, path.bx - path.mid2X) * 180) / Math.PI;
					expect(angleGap(heading, tangent)).toBeLessThan(1);
					// Остриё стоит ровно на конце линии, продолжая её собой.
					const grown = Math.hypot(path.arrowX - path.bx, path.arrowY - path.by);
					expect(grown).toBeCloseTo(path.arrowHeight, 6);
					// И ведёт линия всё-таки в кружок, а не мимо: точно в середину она
					// не целит (на тесном столе дуга спускается на кружок сверху, и
					// приходит в него под углом), но и вдоль него не проходит.
					expect(angleGap(heading, degTo(path, target))).toBeLessThan(45);
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
					// Дуга ровная — половина эллипса: её макушка приходится ровно на
					// середину между кружками, а не съезжает к одному из них.
					const from = roomPlayerPoint(String(seat), seats);
					const to = roomPlayerPoint(String(targetSeat), seats);
					expect(peakAlong(path, from, to)).toBeCloseTo(0.5, 2);
					// Значок сидит на этой самой макушке, поровну от обоих кружков.
					expect(Math.hypot(apex.x - from.x, apex.y - from.y))
						.toBeCloseTo(Math.hypot(apex.x - to.x, apex.y - to.y), 6);
					// Обход и правда обход: путь длиннее прямой между его же концами.
					const detour = Math.hypot(apex.x - path.ax, apex.y - path.ay)
						+ Math.hypot(path.bx - apex.x, path.by - apex.y);
					const direct = Math.hypot(path.bx - path.ax, path.by - path.ay);
					expect(detour).toBeGreaterThan(direct);
					// И ради этого всё затевалось: видно его больше, чем было видно
					// прямой стрелки — той доставался один просвет между кружками.
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
