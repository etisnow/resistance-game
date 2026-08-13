import {clamp} from 'lodash';
import {degToRag} from 'client/helpers/roomHelpers';
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
 * Поэтому теснящимся соседям путь идёт не насквозь, а в обход — дугой наружу,
 * по форме того же круга рассадки. Снаружи кольца места сколько угодно: дуга
 * выходит из кружка наружу, обходит промежуток по большому радиусу и входит в
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
	// Углы мест за столом, в градусах (см. roomPlayerAngle): по ним строится дуга.
	fromAngle: number;
	toAngle: number;
	// Соседи ли по кругу. В обход можно вести только их: между не соседями сидит
	// кто-то третий, и дуга прошла бы прямо по нему.
	isNeighbours: boolean;
	badgeRadius: number;
	// Полуоси круга рассадки: дуга идёт по нему же, только шире.
	seatRadii: {rx: number; ry: number};
	// Радиус значка действия, который сядет на вершину дуги: за поле он вылезать
	// не должен, и вынос дуги считается с оглядкой на него.
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
// уже не читается: во столько должен уложиться значок действия (он сам шириной
// почти в радиус, см. tradeIconShare) и хоть сколько-то линии по бокам от него.
const tightGapShare = 1.5;
// Насколько дуга выходит за круг рассадки — в долях радиуса кружка. Меньше
// радиуса нельзя: вершина дуги должна оказаться снаружи обоих кружков, а не
// пройти по их плечам.
const bulgeShare = 1.15;

const pointAt = (radius: number, deg: number, from: IPoint): IPoint => {
	const rad = degToRag(deg);
	return {x: from.x + radius * Math.cos(rad), y: from.y + radius * Math.sin(rad)};
};

const degBetween = (from: IPoint, to: IPoint): number => Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;

const distance = (from: IPoint, to: IPoint): number => Math.hypot(to.x - from.x, to.y - from.y);

// Точка на кромке кружка в сторону цели плюс отступ.
const edgeToward = (badge: IPoint, target: IPoint, reach: number): IPoint => {
	const span = distance(badge, target);
	if (span < 1) return {x: badge.x, y: badge.y};
	return {
		x: badge.x + ((target.x - badge.x) / span) * reach,
		y: badge.y + ((target.y - badge.y) / span) * reach,
	};
};

const headHeight = (length: number): number => clamp(length * headShare, headMin, headMax);

// Отступ от кромки свободного поля — тот же, что у всей комнаты (roomMargin):
// значок, вплотную прижатый к краю экрана, выглядит обрезанным, даже когда он
// весь на виду.
const fieldMargin = 0.04;

/**
 * Насколько дуге можно выйти за круг рассадки в эту сторону, чтобы значок на её
 * вершине остался на виду целиком.
 *
 * Круг рассадки вписан в свободное поле вместе с кружками (см. roomRadii), так
 * что снаружи него остаётся немного, а на узком экране — считанные пиксели.
 * Вынос поэтому не константа, а меньшее из желаемого и возможного: лучше дуга
 * поменьше, чем значок, наполовину уехавший за край.
 *
 * Поле отмеряется от середины комнаты, а она поднята над серединой поля
 * (roomLift): сверху места ровно на столько меньше, снизу на столько же больше.
 */
const fitBulge = (cos: number, sin: number, seatRadii: {rx: number; ry: number}, iconRadius: number): number => {
	const field = tableField();
	const lift = roomLift();
	const along = (limit: number, radius: number, axis: number): number =>
		(limit * (1 - fieldMargin) - iconRadius - Math.abs(radius * axis)) / Math.max(Math.abs(axis), 1e-6);
	return Math.max(0, Math.min(
		along(field.width / 2, seatRadii.rx, cos),
		along(sin < 0 ? field.height / 2 - lift : field.height / 2 + lift, seatRadii.ry, sin),
	));
};

/** Прямой путь: из кружка в кружок, с лёгким изгибом опорными точками. */
const straightPath = ({from, to, badgeRadius}: IArrowPathArgs): IArrowGeometry => {
	const reach = badgeRadius + badgePad;
	const deg = degBetween(from, to);

	const start = pointAt(reach, deg, from);
	const tip = pointAt(reach, deg - 180, to);
	const height = headHeight(distance(start, tip));
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
		arrowX: tip.x,
		arrowY: tip.y,
		arrowRotation: deg + 90,
		arrowHeight: height,
		midX: mid.x,
		midY: mid.y,
	};
};

/**
 * Обходной путь: дуга наружу по кругу рассадки.
 *
 * Вершину берём на том же круге, только шире, на угле ровно между местами, — так
 * дуга повторяет форму стола, а не выпирает от него в сторону. Дальше кривая
 * строится через эту вершину: концы у кружков развёрнуты не друг на друга, а на
 * неё, поэтому стрелка выходит из бейджа наружу и в соседа входит снаружи же.
 */
const arcPath = ({from, to, fromAngle, toAngle, badgeRadius, seatRadii, iconRadius}: IArrowPathArgs): IArrowGeometry => {
	const reach = badgeRadius + badgePad;
	// Кратчайший поворот от места к месту: обходить надо тот промежуток, что
	// между ними, а не весь стол в другую сторону.
	const turn = ((((toAngle - fromAngle) % 360) + 540) % 360) - 180;
	const midRad = degToRag(fromAngle + turn / 2);
	const cos = Math.cos(midRad);
	const sin = Math.sin(midRad);
	const bulge = Math.min(badgeRadius * bulgeShare, fitBulge(cos, sin, seatRadii, iconRadius));
	const apex = {
		x: (seatRadii.rx + bulge) * cos,
		y: (seatRadii.ry + bulge) * sin,
	};

	const start = edgeToward(from, apex, reach);
	const tip = edgeToward(to, apex, reach);
	// Длина пути — по ломаной через вершину: сама дуга чуть короче, но наконечник
	// от этого не изменится, он и так упирается в свой предел.
	const height = headHeight(distance(start, apex) + distance(apex, tip));
	const end = edgeToward(to, apex, reach + height);

	// Кривая обязана пройти ровно через вершину: на ней сидит значок действия, и
	// «примерно там» значит «наполовину на кружке». У кубической кривой середина
	// — это (A + 3·C1 + 3·C2 + B)/8, поэтому опорные точки берём из квадратичной
	// (её середина — (A + 2·Q + B)/4) и переводим в кубические.
	const controlX = (4 * apex.x - start.x - end.x) / 2;
	const controlY = (4 * apex.y - start.y - end.y) / 2;

	return {
		ax: start.x,
		ay: start.y,
		bx: end.x,
		by: end.y,
		mid1X: start.x + (2 / 3) * (controlX - start.x),
		mid1Y: start.y + (2 / 3) * (controlY - start.y),
		mid2X: end.x + (2 / 3) * (controlX - end.x),
		mid2Y: end.y + (2 / 3) * (controlY - end.y),
		arrowX: tip.x,
		arrowY: tip.y,
		// Наконечник смотрит туда же, куда приходит дуга, — с вершины на кружок.
		arrowRotation: degBetween(apex, tip) + 90,
		arrowHeight: height,
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
