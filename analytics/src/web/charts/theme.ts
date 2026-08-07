// Палитра и общие константы графиков.
//
// Цвета взяты из проверенной палитры и подставляются CSS-переменными (styles.css
// держит светлую и тёмную версии). Здесь — только имена ролей: график пишется
// против роли, а не против конкретного hex.
//
// Роли:
//  series-1..3 — категориальные слоты в фиксированном порядке (не тасовать!);
//  good/critical — статус «прав / ошибся»: это состояние, а не ряд данных,
//    поэтому цвет статусный и всегда идёт с подписью;
//  seq-* — последовательная шкала одного тона для тепловой карты.

export const COLORS = {
	series1: 'var(--series-1)',
	series2: 'var(--series-2)',
	series3: 'var(--series-3)',
	good: 'var(--status-good)',
	critical: 'var(--status-critical)',
	grid: 'var(--grid)',
	surface: 'var(--surface-1)',
	textPrimary: 'var(--text-primary)',
	textSecondary: 'var(--text-secondary)',
	textMuted: 'var(--text-muted)',
};

/** Сторона победы — фиксированные слоты, одинаковые на всех страницах. */
export const SIDE_COLORS = {
	thing: COLORS.series1,
	humans: COLORS.series2,
};

/**
 * Последовательная шкала (один тон, светлый -> тёмный) для тепловой карты.
 * Светлый конец «почти фон» — это допустимо для непрерывной величины.
 */
export const SEQUENTIAL = [
	'var(--seq-100)',
	'var(--seq-200)',
	'var(--seq-300)',
	'var(--seq-400)',
	'var(--seq-500)',
	'var(--seq-600)',
	'var(--seq-700)',
];

const sequentialIndex = (value: number, max: number): number =>
	Math.min(SEQUENTIAL.length - 1, Math.floor(Math.min(1, value / max) * SEQUENTIAL.length));

export const sequentialColor = (value: number, max: number): string => {
	if (max <= 0 || value <= 0) return 'var(--surface-2)';
	return SEQUENTIAL[sequentialIndex(value, max)] ?? SEQUENTIAL[0] ?? 'var(--seq-400)';
};

/**
 * Цвет подписи внутри ячейки. Считать его «по доле от максимума» нельзя: в
 * тёмной теме шкала идёт от тёмного к светлому, и белая цифра на верхней
 * ступени становится нечитаемой. Поэтому чернила заданы отдельной переменной на
 * каждую ступень — в каждой теме своей.
 */
export const sequentialInk = (value: number, max: number): string => {
	if (max <= 0 || value <= 0) return COLORS.textMuted;
	return `var(--seq-ink-${(sequentialIndex(value, max) + 1) * 100})`;
};

/** Толщина марок и отступы — одни и те же во всех графиках. */
export const MARK = {
	maxBar: 24,
	radius: 4,
	line: 2,
	dot: 4,
	/** Зазор цветом фона между соседними марками. */
	gap: 2,
};

export const AXIS = {
	left: 44,
	right: 16,
	top: 16,
	bottom: 28,
};

/** Красивые деления оси: 0, 5, 10 … вместо 0, 3.7, 7.4. */
export const niceTicks = (max: number, count = 4): number[] => {
	if (max <= 0) return [0];
	const rough = max / count;
	const magnitude = 10 ** Math.floor(Math.log10(rough));
	const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough) ?? magnitude * 10;
	const ticks: number[] = [];
	for (let value = 0; value <= max + step / 2; value += step) ticks.push(Math.round(value * 100) / 100);
	return ticks;
};
