import {describe, expect, test} from 'bun:test';
import {perspectiveEdges, perspectiveRowWidth, perspectiveRowY, perspectiveVertices} from 'client/helpers/perspective';

// Карта лежит на столе: ближний к смотрящему край шире дальнего. Перепутанные
// местами края дают карту, широкую вдали и узкую вблизи, — на глаз посреди
// стола это ловится плохо, поэтому проверяем счётом.

const width = 200;
const height = 120;
const taper = 0.84;
const gridX = 8;
const gridY = 14;

// Узлы идут рядами сверху вниз, парами x, y.
const rowOf = (data: Float32Array, row: number) => {
	const points: {x: number, y: number}[] = [];
	for (let col = 0; col < gridX; col++) {
		const at = (row * gridX + col) * 2;
		points.push({x: data[at]!, y: data[at + 1]!});
	}
	return points;
};
const rowWidthOf = (data: Float32Array, row: number) => {
	const points = rowOf(data, row);
	return points[points.length - 1]!.x - points[0]!.x;
};

describe('перспектива лежащей карты', () => {
	test('дальний край уже ближнего ровно во столько раз, во сколько просили', () => {
		const {near, far} = perspectiveEdges(width, taper);
		expect(far / near).toBeCloseTo(taper, 10);
		// Ширина посередине — та, что заложила вёрстка: от неё считают всё остальное.
		expect((near + far) / 2).toBeCloseTo(width, 10);
	});

	test('верхний ряд узкий, нижний широкий — а не наоборот', () => {
		const data = perspectiveVertices(width, height, taper, gridX, gridY);
		const top = rowWidthOf(data, 0);
		const bottom = rowWidthOf(data, gridY - 1);
		expect(top).toBeLessThan(bottom);
		expect(top / bottom).toBeCloseTo(taper, 6);
	});

	test('карта занимает ровно свою высоту и стоит по центру', () => {
		const data = perspectiveVertices(width, height, taper, gridX, gridY);
		expect(rowOf(data, 0)[0]!.y).toBeCloseTo(-height / 2, 6);
		expect(rowOf(data, gridY - 1)[0]!.y).toBeCloseTo(height / 2, 6);
		// Каждый ряд симметричен относительно середины.
		const middle = rowOf(data, 3);
		expect(middle[0]!.x).toBeCloseTo(-middle[middle.length - 1]!.x, 6);
	});

	test('дальняя половина картинки занимает на экране меньше места, чем ближняя', () => {
		const {near, far} = perspectiveEdges(width, taper);
		const middle = perspectiveRowY(0.5, height, near, far);
		expect(middle).toBeLessThan(height / 2);
		// Ряды сгущаются к дальнему краю монотонно, без скачков.
		const data = perspectiveVertices(width, height, taper, gridX, gridY);
		let previous = -Infinity;
		let previousStep = 0;
		for (let row = 0; row < gridY; row++) {
			const y = rowOf(data, row)[0]!.y;
			expect(y).toBeGreaterThan(previous);
			const step = y - previous;
			if (row > 1) expect(step).toBeGreaterThan(previousStep);
			previousStep = step;
			previous = y;
		}
	});

	test('края трапеции прямые: ширина меняется по высоте линейно', () => {
		const {near, far} = perspectiveEdges(width, taper);
		expect(perspectiveRowWidth(0, height, near, far)).toBeCloseTo(far, 10);
		expect(perspectiveRowWidth(height, height, near, far)).toBeCloseTo(near, 10);
		expect(perspectiveRowWidth(height / 2, height, near, far)).toBeCloseTo((near + far) / 2, 10);
	});

	test('вырожденная карта (переворот паники схлопывает её в ноль) не ломает сетку', () => {
		const data = perspectiveVertices(0, height, taper, gridX, gridY);
		expect(data.every((value) => Number.isFinite(value))).toBe(true);
		expect(rowWidthOf(data, 0)).toBe(0);
	});
});
