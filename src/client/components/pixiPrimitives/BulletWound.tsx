import { CustomPIXIComponent } from "react-pixi-fiber";
import * as PIXI from "pixi.js";
import type { GraphicsBehaviorThis } from "./behaviorTypes";

/**
 * След выстрела на лице: пробоина, разбежавшиеся от неё трещины и кровь по ним.
 * Кружок игрока в «Сопротивлении» — не человек, а его карточка, и стреляют
 * именно в неё: поэтому трещины стеклянные, с концентрическими кольцами вокруг
 * пробоины, как на простреленном стекле.
 *
 * Рисунок держится на сиде (обычно это id игрока): у каждого простреленного он
 * свой, но один и тот же от кадра к кадру и после реконнекта — иначе трещины
 * перерисовывались бы заново на каждом обновлении стола.
 *
 * Растёт он сам, от появления на столе: выстрел — мгновение, а трещины идут по
 * стеклу и кровь набегает уже после. Пружины здесь не нужны — прогресс идёт по
 * времени, и второго такого выстрела в партии не будет.
 */
interface BulletWoundProps {
	// Полуоси лица: рана не должна вылезать за кружок.
	rx: number;
	ry: number;
	seed: string;
}

// Сколько живёт появление, в секундах: сначала трещины, потом кровь.
const crackGrowSeconds = 0.45;
const bloodDelaySeconds = 0.3;
const bloodGrowSeconds = 1.6;

// Пробоина и трещины. Всё это лежит на пёстрой аватарке размером с ноготь,
// поэтому линии заметно толще, чем просит рисунок: тонкая трещина на таком
// масштабе просто теряется в лице.
const cracksCount = 7;
const crackSegments = 4;
// Луч не дотягивается до края лица: трещина, упирающаяся в самый обод, читается
// как рамка, а не как разлом.
const crackReachMin = 0.62;
const crackReachMax = 0.98;
// Насколько луч виляет вбок, в долях своей длины.
const crackWander = 0.22;
// Кольца вокруг пробоины — на этих долях длины лучей.
const crackRings = [0.24, 0.5];
const crackColor = 0x0A0508;
const crackGlint = 0xE8F2F8;
const holeColor = 0x0B0305;
// Тёмный ореол вокруг пробоины: без него дырка тонет в тёмных местах лица.
const bruiseColor = 0x1A0508;

// Кровь. Потёки идут вниз — их ведёт та же сила, что и настоящие.
const bloodStreaks = 3;
const bloodColor = 0xB01018;
const bloodDark = 0x5C070C;
const bloodReachMin = 0.5;
const bloodReachMax = 1;

const hashSeed = (seed: string): number => {
	let hash = 2166136261;
	for (let i = 0; i < seed.length; i++) {
		hash ^= seed.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
};

// Тот же mulberry32, что и у партии на сервере: рисунок должен быть
// воспроизводимым, а не «каким получится».
const rngFrom = (seed: number): (() => number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

interface IPoint {x: number, y: number}

interface IWoundShape {
	hit: IPoint;
	holeRadius: number;
	// Каждая трещина — ломаная от пробоины наружу.
	cracks: IPoint[][];
	// Потёки крови: ломаная вниз и толщина у истока.
	streaks: {path: IPoint[], width: number}[];
}

/**
 * Докуда можно идти из точки в этом направлении, не вылезая за эллипс. Решаем
 * то самое квадратное уравнение: подставляем луч в уравнение эллипса.
 */
const reachInside = (from: IPoint, dx: number, dy: number, rx: number, ry: number): number => {
	const a = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
	if (a <= 0) return 0;
	const b = 2 * ((from.x * dx) / (rx * rx) + (from.y * dy) / (ry * ry));
	const c = (from.x * from.x) / (rx * rx) + (from.y * from.y) / (ry * ry) - 1;
	const disc = b * b - 4 * a * c;
	if (disc <= 0) return 0;
	return Math.max(0, (-b + Math.sqrt(disc)) / (2 * a));
};

const buildShape = (rx: number, ry: number, seed: string): IWoundShape => {
	const rng = rngFrom(hashSeed(seed));
	// Попадание — в верхнюю половину лица и чуть в сторону: точно по центру оно
	// выглядело бы мишенью, а не выстрелом.
	const hit: IPoint = {
		x: (rng() - 0.5) * rx * 0.7,
		y: -ry * (0.05 + rng() * 0.35),
	};
	const holeRadius = rx * (0.11 + rng() * 0.04);

	const cracks: IPoint[][] = [];
	const step = (Math.PI * 2) / cracksCount;
	for (let i = 0; i < cracksCount; i++) {
		const angle = i * step + (rng() - 0.5) * step * 0.8;
		const dx = Math.cos(angle);
		const dy = Math.sin(angle);
		const reach = reachInside(hit, dx, dy, rx, ry)
			* (crackReachMin + rng() * (crackReachMax - crackReachMin));
		const path: IPoint[] = [hit];
		for (let s = 1; s <= crackSegments; s++) {
			const along = (reach * s) / crackSegments;
			// Виляние — поперёк луча, и тем сильнее, чем дальше от пробоины.
			const side = (rng() - 0.5) * crackWander * along;
			path.push({
				x: hit.x + dx * along - dy * side,
				y: hit.y + dy * along + dx * side,
			});
		}
		cracks.push(path);
	}

	const streaks: {path: IPoint[], width: number}[] = [];
	for (let i = 0; i < bloodStreaks; i++) {
		const from: IPoint = {
			x: hit.x + (rng() - 0.5) * holeRadius * 2.2,
			y: hit.y + holeRadius * 0.4,
		};
		const reach = reachInside(from, 0, 1, rx, ry)
			* (bloodReachMin + rng() * (bloodReachMax - bloodReachMin));
		const path: IPoint[] = [from];
		for (let s = 1; s <= 3; s++) {
			const along = (reach * s) / 3;
			path.push({x: from.x + (rng() - 0.5) * rx * 0.06 * s, y: from.y + along});
		}
		streaks.push({path, width: rx * (0.08 + rng() * 0.06)});
	}

	return {hit, holeRadius, cracks, streaks};
};

// Ломаная, пройденная только на долю своей длины.
const partialPath = (path: IPoint[], share: number): IPoint[] => {
	if (share >= 1) return path;
	if (share <= 0) return [];
	const total = path.length - 1;
	const done = total * share;
	const full = Math.floor(done);
	const out = path.slice(0, full + 1);
	const tail = path[full + 1];
	const head = path[full];
	if (tail && head) {
		const t = done - full;
		out.push({x: head.x + (tail.x - head.x) * t, y: head.y + (tail.y - head.y) * t});
	}
	return out;
};

class BulletWoundGraphics extends PIXI.Graphics {
	config: BulletWoundProps = {rx: 0, ry: 0, seed: ''};
	private shape: IWoundShape | null = null;
	private startedAt = 0;

	setShape() {
		const {rx, ry, seed} = this.config;
		this.shape = rx > 0 && ry > 0 ? buildShape(rx, ry, seed) : null;
	}

	redraw() {
		const shape = this.shape;
		this.clear();
		if (!shape) return;
		const {rx} = this.config;
		const elapsed = this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0;
		const crackShare = Math.min(1, elapsed / crackGrowSeconds);
		const bloodShare = Math.min(1, Math.max(0, (elapsed - bloodDelaySeconds) / bloodGrowSeconds));
		const line = Math.max(1.5, rx * 0.055);

		// Кровь — под трещинами: она течёт из-под стекла, а не поверх него.
		if (bloodShare > 0) {
			for (const {path, width} of shape.streaks) {
				const drawn = partialPath(path, bloodShare);
				if (drawn.length < 2) continue;
				for (const [color, scale, alpha] of [[bloodDark, 1.25, 0.75], [bloodColor, 1, 0.9]] as const) {
					this.lineStyle(width * scale, color, alpha);
					drawn.forEach((point, index) => index ? this.lineTo(point.x, point.y) : this.moveTo(point.x, point.y));
					// Скруглять концы и стыки умеет lineStyle({cap, join}), но в этой
					// версии pixi его ещё нет: сглаживаем изломы кружками по узлам —
					// иначе на каждом повороте потёк рвётся углом.
					this.lineStyle(0);
					this.beginFill(color, alpha);
					drawn.forEach((point) => this.drawCircle(point.x, point.y, width * scale / 2));
					this.endFill();
				}
				// Капля на конце потёка: она и делает его текущим, а не нарисованным.
				const tip = drawn[drawn.length - 1]!;
				this.lineStyle(0);
				this.beginFill(bloodColor, 0.9);
				this.drawCircle(tip.x, tip.y, width * 0.75);
				this.endFill();
			}
		}

		// Трещины: тёмный разлом с холодным бликом по одной стороне — так стекло и
		// выглядит на просвет.
		for (const path of shape.cracks) {
			const drawn = partialPath(path, crackShare);
			if (drawn.length < 2) continue;
			for (const [color, width, alpha, shift] of [
				[crackGlint, line * 0.6, 0.5, -line * 0.55],
				[crackColor, line, 1, 0],
			] as const) {
				this.lineStyle(width, color, alpha);
				drawn.forEach((point, index) => index
					? this.lineTo(point.x + shift, point.y + shift)
					: this.moveTo(point.x + shift, point.y + shift));
			}
		}

		// Кольца вокруг пробоины — по тем же лучам, на их долях: так они и идут по
		// настоящему стеклу, от трещины к трещине.
		for (const ring of crackRings) {
			if (crackShare < ring) continue;
			this.lineStyle(line * 0.8, crackColor, 0.8);
			shape.cracks.forEach((path, index) => {
				const point = partialPath(path, ring);
				const at = point[point.length - 1];
				if (!at) return;
				if (index === 0) this.moveTo(at.x, at.y);
				else this.lineTo(at.x, at.y);
			});
			const first = partialPath(shape.cracks[0] ?? [], ring);
			const close = first[first.length - 1];
			if (close) this.lineTo(close.x, close.y);
		}

		// Сама пробоина: тёмный ореол, дырка, запёкшийся ободок.
		this.lineStyle(0);
		this.beginFill(bruiseColor, 0.5);
		this.drawCircle(shape.hit.x, shape.hit.y, shape.holeRadius * 2.1);
		this.endFill();
		this.beginFill(holeColor, 1);
		this.drawCircle(shape.hit.x, shape.hit.y, shape.holeRadius);
		this.endFill();
		this.lineStyle(line * 0.9, bloodDark, 0.85);
		this.drawCircle(shape.hit.x, shape.hit.y, shape.holeRadius * 1.15);
	}

	private run = () => {
		// Рисунок замирает, как только всё выросло: перерисовывать неподвижное по
		// шестьдесят раз в секунду незачем — до конца партии.
		const elapsed = (Date.now() - this.startedAt) / 1000;
		if (elapsed > bloodDelaySeconds + bloodGrowSeconds) return;
		this.redraw();
	};

	constructor() {
		super();
		this.startedAt = Date.now();
		PIXI.Ticker.shared.add(this.run);
	}

	override destroy(options?: {children?: boolean, texture?: boolean, baseTexture?: boolean}) {
		PIXI.Ticker.shared.remove(this.run);
		super.destroy(options);
	}
}

const TYPE = "BulletWound";
export const behavior = {
	customDisplayObject: (_props: BulletWoundProps) => new BulletWoundGraphics(),
	customApplyProps: function(
		this: GraphicsBehaviorThis<BulletWoundProps>,
		instance: BulletWoundGraphics,
		oldProps: BulletWoundProps | undefined,
		newProps: BulletWoundProps,
	) {
		const isSameShape = oldProps
			&& oldProps.rx === newProps.rx
			&& oldProps.ry === newProps.ry
			&& oldProps.seed === newProps.seed;
		instance.config = newProps;
		if (!isSameShape) instance.setShape();
		instance.redraw();

		this.applyDisplayObjectProps(oldProps, newProps);
	},
};

export default CustomPIXIComponent(behavior, TYPE);
