/**
 * Геометрия карты, лежащей на столе: ближний к смотрящему край шире дальнего, и
 * к дальнему краю картинка не только сужается, но и сжимается по высоте —
 * дальняя половина занимает на экране меньше места, чем ближняя.
 *
 * Пусть Wn — ближний край, Wf — дальний, H — высота на экране, v — координата по
 * картинке (0 у дальнего края, 1 у ближнего). Тогда
 *
 *     y(v) = H·Wf·v / (Wn + (Wf − Wn)·v),   W(y) = Wf + (Wn − Wf)·y/H
 *
 * — то есть строки текстуры сгущаются к дальнему краю, а сами края трапеции
 * остаются прямыми. Это обычная проекция плоскости: однородная координата
 * меняется вдоль картинки линейно, а экранный размер обратен ей.
 *
 * Живёт отдельно от примитива (см. PerspectiveTexture), потому что это чистая
 * арифметика: перепутанные местами ближний и дальний края дают карту, широкую
 * вдали и узкую вблизи, и на глаз в мельтешении стола это ловится плохо.
 */

// Ближняя и дальняя кромки по ширине посередине: считать от середины удобнее —
// размер «в среднем» остаётся тем, что заложила вёрстка.
export const perspectiveEdges = (width: number, taper: number): {near: number, far: number} => {
	const near = (width * 2) / (1 + taper);
	return {near, far: near * taper};
};

// Экранная высота строки текстуры v (0 — дальний край, 1 — ближний), считая от
// дальнего края. Схлопнутая в ноль карта (так переворачивается паника) кладётся
// ровно, без перспективы: сходиться в точку там уже нечему, а деление ноля на
// ноль сделало бы всю сетку нечислом.
export const perspectiveRowY = (v: number, height: number, near: number, far: number): number => {
	const depth = near + (far - near) * v;
	return depth > 0 ? (height * far * v) / depth : height * v;
};

// Ширина трапеции на экранной высоте y (0 — дальний край, height — ближний).
export const perspectiveRowWidth = (y: number, height: number, near: number, far: number): number =>
	far + (near - far) * (y / height);

/**
 * Узлы сетки, на которую натягивается картинка: сначала все узлы верхнего ряда,
 * потом следующего и так далее — парами x, y относительно середины карты.
 */
export const perspectiveVertices = (
	width: number,
	height: number,
	taper: number,
	gridX: number,
	gridY: number,
): Float32Array => {
	const {near, far} = perspectiveEdges(width, taper);
	const data = new Float32Array(gridX * gridY * 2);
	let at = 0;
	for (let row = 0; row < gridY; row++) {
		const y = perspectiveRowY(row / (gridY - 1), height, near, far);
		const rowWidth = perspectiveRowWidth(y, height, near, far);
		for (let col = 0; col < gridX; col++) {
			data[at++] = (col / (gridX - 1) - 0.5) * rowWidth;
			data[at++] = y - height / 2;
		}
	}
	return data;
};
