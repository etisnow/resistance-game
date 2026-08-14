import {clamp} from 'lodash';
import {badgeAspect, degToRag} from 'client/helpers/roomHelpers';
import {roomLift, tableField} from 'client/helpers/window';

/**
 * Путь стрелки действия между двумя местами за столом (см. Room, TradeArrow).
 *
 * Стрелка идёт от кружка к кружку и почти всегда — по прямой. Но соседи по столу
 * сидят вплотную, а у боков круга рассадки (там, где сплюснутый эллипс уходит
 * вглубь) их кружки ещё и заходят друг за друга. Прямой стрелке между ними
 * остаётся десяток пикселей: от неё видно один наконечник, а значок действия
 * приходится ровно на стык кружков и налезает на оба.
 *
 * Поэтому теснящимся соседям путь идёт не насквозь, а в обход — ровной дугой
 * наружу, половиной эллипса над отрезком между кружками. Снаружи кольца места
 * сколько угодно: дуга выходит из кружка наружу, обходит промежуток и входит в
 * соседа с внешней стороны, а значок садится на её вершину, на чистый стол.
 *
 * Порог именно на тесноту, а не на «соседей вообще»: за столом вчетвером соседи
 * сидят далеко, и обходить там нечего — прямая между ними и короче, и понятнее.
 */

export interface IPoint {
	x: number;
	y: number;
}

export interface IArrowGeometry {
	// Начало пути (на кромке кружка атакующего) и его конец (у наконечника).
	ax: number;
	ay: number;
	bx: number;
	by: number;
	// Опорные точки кубической кривой: ими путь и гнётся.
	mid1X: number;
	mid1Y: number;
	mid2X: number;
	mid2Y: number;
	// Остриё наконечника и его разворот (0° — вверх, см. Arrow).
	arrowX: number;
	arrowY: number;
	arrowRotation: number;
	arrowHeight: number;
	// Середина пути: на ней сидит значок действия или карта, которой ходят.
	midX: number;
	midY: number;
}

interface IArrowPathArgs {
	from: IPoint;
	to: IPoint;
	// Соседи ли по кругу. В обход можно вести только их: между не соседями сидит
	// кто-то третий, и дуга прошла бы прямо по нему.
	isNeighbours: boolean;
	badgeRadius: number;
	// Радиус значка действия, который сядет на вершину дуги: за поле он вылезать
	// не должен, и высота дуги считается с оглядкой на него.
	iconRadius: number;
}

// Зазор между кружком и концом стрелки: упираться в бейдж она не должна.
const badgePad = 5;
// Наконечник — доля длины пути, но в этих пределах: на длинной стрелке он не
// должен разрастаться в лопату, на короткой — исчезать.
const headShare = 0.35;
const headMin = 3;
const headMax = 15;
// Насколько прямой путь отводит опорные точки вбок: лёгкая дуга вместо линейки.
const straightBowShare = 0.25;

// Меньше этого просвета между кружками (в долях радиуса кружка) прямая стрелка
// уже не читается: во столько должен уложиться значок действия (он шириной в
// полрадиуса, см. tradeIconShare) и по половине радиуса линии с каждого бока —
// иначе от стрелки видно один значок.
const tightGapShare = 1.5;
// Насколько вершина дуги отходит от кружков — в долях их высоты (кружок выше,
// чем шире, см. badgeAspect; меряем по большей стороне, чтобы не проверять
// каждый раз, с какого боку дуга обходит кружок). Меньше единицы нельзя:
// вершина должна оказаться снаружи обоих кружков, а не пройти по их плечам.
const apexClearShare = 1.1;
// Но и прижиматься к отрезку дуга не должна: у широко расставленных соседей
// вершина обошла бы кружки и без всякого подъёма, и обход выродился бы в ту
// самую прямую, от которой мы уходим. Подъём над отрезком — не меньше вот
// стольких радиусов кружка: примерно на столько же дугу выносило наружу круга
// рассадки, пока она шла по нему.
const minRiseShare = 1.3;

const pointAt = (radius: number, deg: number, from: IPoint): IPoint => {
	const rad = degToRag(deg);
	return {x: from.x + radius * Math.cos(rad), y: from.y + radius * Math.sin(rad)};
};

const degBetween = (from: IPoint, to: IPoint): number => Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;

const distance = (from: IPoint, to: IPoint): number => Math.hypot(to.x - from.x, to.y - from.y);

const headHeight = (length: number): number => clamp(length * headShare, headMin, headMax);

/**
 * Наконечник на конце пути.
 *
 * Он продолжение самой линии, а не отдельная стрелочка рядом с ней: стоит на её
 * конце и смотрит туда же, куда линия приходит. Куда она приходит — говорит
 * последняя опорная точка кривой: в конце путь идёт из неё в конец, это и есть
 * касательная. Раньше наконечник разворачивали на центр кружка, и на дуге он
 * выходил свёрнут набок: кривая подходит к кружку по касательной, а не по хорде
 * «вершина — центр», и треугольник сидел на линии криво.
 */
const headAt = (control: IPoint, end: IPoint, height: number) => {
	const heading = degBetween(control, end);
	const tip = pointAt(height, heading, end);
	return {arrowX: tip.x, arrowY: tip.y, arrowRotation: heading + 90, arrowHeight: height};
};

// Дуга живёт квадратичной кривой (у неё одна опорная точка, и подрезать её
// проще): концы — центры кружков, а вершина посередине задаёт весь изгиб.
interface IQuad {
	a: IPoint;
	c: IPoint;
	b: IPoint;
}

const quadAt = ({a, c, b}: IQuad, t: number): IPoint => {
	const u = 1 - t;
	return {x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y};
};

const lerp = (from: IPoint, to: IPoint, t: number): IPoint =>
	({x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t});

// Кусок кривой между двумя её точками — снова квадратичная кривая (де Кастельжо).
const quadPart = ({a, c, b}: IQuad, from: number, to: number): IQuad => ({
	a: quadAt({a, c, b}, from),
	c: lerp(lerp(a, c, from), lerp(c, b, from), to),
	b: quadAt({a, c, b}, to),
});

// Где кривая отходит от кружка на нужное расстояние: с этой точки её и видно.
// Ищем перебором пополам — точное решение тут уравнение четвёртой степени, а
// нам довольно и доли пикселя. `inside` — конец, который лежит в кружке.
const crossing = (quad: IQuad, badge: IPoint, reach: number, inside: number, outside: number): number => {
	let near = inside;
	let far = outside;
	for (let step = 0; step < 20; step += 1) {
		const t = (near + far) / 2;
		if (distance(quadAt(quad, t), badge) < reach) near = t;
		else far = t;
	}
	return (near + far) / 2;
};

// Отступ от кромки свободного поля — тот же, что у всей комнаты (roomMargin):
// значок, вплотную прижатый к краю экрана, выглядит обрезанным, даже когда он
// весь на виду.
const fieldMargin = 0.04;

/**
 * Насколько высоко вершине дуги можно подняться над отрезком между кружками,
 * чтобы значок на ней остался на виду целиком.
 *
 * Круг рассадки вписан в свободное поле вместе с кружками (см. roomRadii), так
 * что снаружи него остаётся немного, а на узком экране — считанные пиксели.
 * Подъём поэтому не константа, а меньшее из желаемого и возможного: лучше дуга
 * поменьше, чем значок, наполовину уехавший за край.
 *
 * Поле отмеряется от середины комнаты, а она поднята над серединой поля
 * (roomLift): сверху места ровно на столько меньше, снизу на столько же больше.
 */
const fitRise = (base: IPoint, away: IPoint, iconRadius: number): number => {
	const field = tableField();
	const lift = roomLift();
	// Докуда можно уехать по одной оси: до края поля за вычетом отступа и самого
	// значка. Куда именно уехать — покажет знак направления.
	const along = (at: number, dir: number, limit: number): number =>
		Math.abs(dir) < 1e-6 ? Infinity : (limit * (1 - fieldMargin) - iconRadius - at * Math.sign(dir)) / Math.abs(dir);
	return Math.max(0, Math.min(
		along(base.x, away.x, field.width / 2),
		along(base.y, away.y, away.y < 0 ? field.height / 2 - lift : field.height / 2 + lift),
	));
};

/** Прямой путь: из кружка в кружок, с лёгким изгибом опорными точками. */
const straightPath = ({from, to, badgeRadius}: IArrowPathArgs): IArrowGeometry => {
	const reach = badgeRadius + badgePad;
	const deg = degBetween(from, to);

	const start = pointAt(reach, deg, from);
	const height = headHeight(distance(start, pointAt(reach, deg - 180, to)));
	const end = pointAt(reach + height, deg - 180, to);

	const mid = {x: (start.x + end.x) / 2, y: (start.y + end.y) / 2};
	const bow = badgeRadius * straightBowShare;
	const {x: mid1X, y: mid1Y} = pointAt(bow, deg - 90, mid);
	const {x: mid2X, y: mid2Y} = pointAt(bow, deg + 90, mid);

	return {
		ax: start.x,
		ay: start.y,
		bx: end.x,
		by: end.y,
		mid1X,
		mid1Y,
		mid2X,
		mid2Y,
		...headAt({x: mid2X, y: mid2Y}, end, height),
		midX: mid.x,
		midY: mid.y,
	};
};

/**
 * Обходной путь: ровная дуга наружу, половиной эллипса над отрезком между
 * кружками.
 *
 * Вершину берём на серединном перпендикуляре к этому отрезку, в стороне от
 * середины стола. Так обе половины пути выходят одинаковыми, а значок садится
 * ровно на макушку дуги.
 *
 * Раньше вершину искали на круге рассадки, на угле ровно посередине между
 * местами, — но круг сплюснут, да и ближние места стянуты к нижнему (см.
 * pullSeatToFront), так что «угол посередине» приходился совсем не на середину
 * пути: дуга выходила кривобокой, с вершиной у одного из кружков.
 *
 * Сама дуга идёт от центра кружка до центра кружка через вершину, а показываем
 * мы её подрезанной по их кромкам. Так путь и приходит в соседа, а не мимо
 * него: на конце он всё ещё нацелен в середину кружка, и наконечник, стоящий
 * по касательной, смотрит туда же. Строить дугу сразу между кромками нельзя —
 * концы у кружков тогда развёрнуты на вершину, кривая приходит к ним боком, и
 * наконечник сидит на ней свёрнутым набок.
 */
const arcPath = (args: IArrowPathArgs): IArrowGeometry => {
	const {from, to, badgeRadius, iconRadius} = args;
	const reach = badgeRadius + badgePad;
	const span = distance(from, to);
	const base = {x: (from.x + to.x) / 2, y: (from.y + to.y) / 2};
	// Куда дуге подниматься: перпендикуляр к отрезку, развёрнутый от середины
	// комнаты (она в начале координат) — то есть наружу от стола.
	const side = {x: -(to.y - from.y) / span, y: (to.x - from.x) / span};
	const away = side.x * base.x + side.y * base.y < 0 ? {x: -side.x, y: -side.y} : side;
	// Вершина должна обойти оба кружка снаружи — не ближе apexClearShare кружков
	// до их центров, — да ещё оставить место наконечнику: он растёт от неё назад,
	// к кружку, и в самой вершине ему уже не поместиться. От середины отрезка до
	// центра кружка уже полспана, столько подниматься и не надо: подъём —
	// оставшийся катет.
	const half = span / 2;
	const clear = Math.max(badgeRadius * badgeAspect * apexClearShare, reach + headMax + badgePad);
	const want = Math.max(Math.sqrt(Math.max(clear * clear - half * half, 0)), badgeRadius * minRiseShare);
	const rise = Math.min(want, fitRise(base, away, iconRadius));
	const apex = {x: base.x + away.x * rise, y: base.y + away.y * rise};

	// Вершина у самого кружка — это уже не обход: показывать нечего, и подрезать
	// дугу негде. На таком поле лучше прямая, она хотя бы не путается в бейджах.
	const clearance = Math.min(distance(apex, from), distance(apex, to));
	if (clearance <= reach + headMin) return straightPath(args);

	// Дуга целиком: от центра кружка до центра кружка, вершиной ровно посередине.
	// Опорная точка квадратичной кривой — та, при которой её середина (A + 2·C +
	// B)/4 попадает в вершину.
	const whole = {a: from, c: {x: 2 * apex.x - base.x, y: 2 * apex.y - base.y}, b: to};
	// Наконечник — доля видимой части пути, но встать он должен целиком между
	// кромкой кружка и вершиной.
	const height = clamp(
		headHeight(distance(from, apex) + distance(apex, to) - 2 * reach),
		headMin,
		clearance - reach,
	);
	// Показываем кривую от кромки одного кружка до кромки другого — конец на
	// длину наконечника раньше, он этот кусок и займёт.
	const seen = quadPart(whole, crossing(whole, from, reach, 0, 0.5), crossing(whole, to, reach + height, 1, 0.5));
	// В отрисовку путь уходит кубической кривой (см. Arrow), а это та же кривая:
	// у квадратичной одна опорная точка, и кубические получаются из неё сдвигом
	// к концам на две трети.
	const mid1 = lerp(seen.a, seen.c, 2 / 3);
	const mid2 = lerp(seen.b, seen.c, 2 / 3);

	return {
		ax: seen.a.x,
		ay: seen.a.y,
		bx: seen.b.x,
		by: seen.b.y,
		mid1X: mid1.x,
		mid1Y: mid1.y,
		mid2X: mid2.x,
		mid2Y: mid2.y,
		...headAt(mid2, seen.b, height),
		// Значок — на самой макушке дуги: она стоит ровно посередине между
		// кружками, и путь через неё проходит (подрезали мы его раньше её).
		// Середина видимого куска для значка не годится: с одного конца путь
		// подрезан ещё и на наконечник, и значок съезжал бы в сторону.
		midX: apex.x,
		midY: apex.y,
	};
};

/** Тесно ли двум местам для прямой стрелки. */
export const isTightPair = ({from, to, isNeighbours, badgeRadius}: IArrowPathArgs): boolean => {
	if (!isNeighbours) return false;
	const span = distance(from, to);
	// Вырожденный случай (игрока уже нет на столе, место пришло нулевым) — тут не
	// до дуг: строить её не из чего.
	if (span < 1) return false;
	return span - 2 * (badgeRadius + badgePad) < badgeRadius * tightGapShare;
};

export const arrowPath = (args: IArrowPathArgs): IArrowGeometry =>
	isTightPair(args) ? arcPath(args) : straightPath(args);
