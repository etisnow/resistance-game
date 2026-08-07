import {el, svg} from 'analytics/web/dom';
import {withTooltip} from 'analytics/web/charts/chartCard';
import {AXIS, COLORS, MARK, niceTicks} from 'analytics/web/charts/theme';
import {num} from 'analytics/web/format';

// Столбики и полосы. Марки тонкие, конец данных скруглён на 4px, основание
// квадратное и стоит на общей базовой линии; между соседями — зазор цветом фона.

export interface IBarDatum {
	label: string;
	value: number;
	color?: string;
	tooltip?: string;
}

/** Вертикальные столбцы: сравнение величин по коротким категориям. */
export const columnChart = ({
	data,
	height = 220,
	valueFormat = num,
	labelEvery = 1,
}: {
	data: IBarDatum[];
	height?: number;
	valueFormat?: (value: number) => string;
	labelEvery?: number;
}): SVGElement => {
	const width = Math.max(320, data.length * 56);
	const plotWidth = width - AXIS.left - AXIS.right;
	const plotHeight = height - AXIS.top - AXIS.bottom;
	const max = Math.max(1, ...data.map((d) => d.value));
	const ticks = niceTicks(max);
	const scaleMax = ticks[ticks.length - 1] ?? max;
	const band = plotWidth / Math.max(1, data.length);
	const barWidth = Math.min(MARK.maxBar, band - 12);

	const root = svg('svg', {
		viewBox: `0 0 ${width} ${height}`,
		class: 'chart chart--column',
		preserveAspectRatio: 'xMidYMid meet',
		role: 'img',
	});

	for (const tick of ticks) {
		const y = AXIS.top + plotHeight - (tick / scaleMax) * plotHeight;
		root.appendChild(
			svg('line', {x1: AXIS.left, x2: width - AXIS.right, y1: y, y2: y, stroke: COLORS.grid, 'stroke-width': 1}),
		);
		root.appendChild(
			svg('text', {x: AXIS.left - 8, y: y + 4, 'text-anchor': 'end', class: 'axis-text'}, []),
		).textContent = valueFormat(tick);
	}

	data.forEach((datum, index) => {
		const x = AXIS.left + index * band + (band - barWidth) / 2;
		const barHeight = Math.max(datum.value > 0 ? 2 : 0, (datum.value / scaleMax) * plotHeight);
		const y = AXIS.top + plotHeight - barHeight;
		const bar = svg('path', {
			d: roundedTopBar(x, y, barWidth, barHeight, MARK.radius),
			fill: datum.color ?? COLORS.series1,
		});
		withTooltip(bar, datum.tooltip ?? `<b>${escapeHtml(datum.label)}</b><br>${valueFormat(datum.value)}`);
		root.appendChild(bar);

		if (index % labelEvery === 0) {
			const label = svg('text', {
				x: x + barWidth / 2,
				y: height - 10,
				'text-anchor': 'middle',
				class: 'axis-text',
			});
			label.textContent = datum.label;
			root.appendChild(label);
		}
	});

	return root;
};

/**
 * Горизонтальные полосы: рейтинги и длинные подписи.
 *
 * Сделано на HTML, а не на SVG, специально: карточки бывают узкими, и
 * масштабирование SVG превратило бы подписи в нечитаемую мелочь. Здесь текст
 * всегда своего размера, а полосы тянутся по ширине карточки.
 */
export const barChart = ({
	data,
	valueFormat = num,
	maxRows = 12,
}: {
	data: IBarDatum[];
	valueFormat?: (value: number) => string;
	maxRows?: number;
}): HTMLElement => {
	const rows = data.slice(0, maxRows);
	const max = Math.max(1, ...rows.map((d) => d.value));
	const list = el('ul', {class: 'barlist'});

	for (const datum of rows) {
		const bar = el('span', {
			class: 'barlist-bar',
			style: `width:${Math.max(datum.value > 0 ? 2 : 0, (datum.value / max) * 100)}%;background:${datum.color ?? COLORS.series1}`,
		});
		const row = el('li', {class: 'barlist-row'}, [
			el('span', {class: 'barlist-label', text: datum.label, title: datum.label}),
			el('span', {class: 'barlist-track'}, [bar]),
			el('span', {class: 'barlist-value', text: valueFormat(datum.value)}),
		]);
		withTooltip(row, datum.tooltip ?? `<b>${escapeHtml(datum.label)}</b><br>${valueFormat(datum.value)}`);
		list.appendChild(row);
	}

	if (data.length > maxRows) {
		list.appendChild(el('li', {class: 'barlist-more', text: `…и ещё ${data.length - maxRows}`}));
	}
	return list;
};

export interface ISplitSegment {
	label: string;
	value: number;
	color: string;
}

/**
 * Одна полоса «часть от целого» вместо бублика: для двух-трёх долей она честнее
 * читается, а подписи ложатся прямо на сегменты.
 */
export const splitBar = ({
	segments,
	height = 56,
	compact = false,
}: {
	segments: ISplitSegment[];
	height?: number;
	/** Без подписей под полосой: когда числа уже стоят рядом в заголовке строки. */
	compact?: boolean;
}): SVGElement => {
	// Широкая система координат: карточка «во всю ширину» почти не растягивает
	// рисунок, и подписи внутри сегментов остаются нормального размера.
	const width = 1000;
	const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
	// Место под подписи снизу нужно только в «полном» режиме.
	const barHeight = compact ? height : height - 22;
	const root = svg('svg', {viewBox: `0 0 ${width} ${height}`, class: 'chart chart--split', role: 'img'});
	let x = 0;
	segments.forEach((segment, index) => {
		const raw = (segment.value / total) * width;
		// Зазор цветом фона отделяет соседние сегменты — обводки не рисуем.
		const segmentWidth = Math.max(0, raw - (index < segments.length - 1 ? MARK.gap : 0));
		const rect = svg('rect', {
			x,
			y: 0,
			width: segmentWidth,
			height: barHeight,
			rx: index === 0 || index === segments.length - 1 ? MARK.radius : 0,
			fill: segment.color,
		});
		withTooltip(
			rect,
			`<b>${escapeHtml(segment.label)}</b><br>${num(segment.value)} · ${Math.round((segment.value / total) * 100)}%`,
		);
		root.appendChild(rect);

		// Подпись помещаем внутрь только если она реально влезает.
		const text = `${segment.label} · ${Math.round((segment.value / total) * 100)}%`;
		if (segmentWidth > text.length * 7.2) {
			const label = svg('text', {x: x + 10, y: barHeight / 2 + 5, class: 'inline-label'});
			label.textContent = text;
			root.appendChild(label);
		}
		if (!compact) {
			const below = svg('text', {x: x + 1, y: height - 4, class: 'axis-text'});
			below.textContent = segmentWidth > 60 ? `${segment.label} ${num(segment.value)}` : '';
			root.appendChild(below);
		}
		x += raw;
	});
	return root;
};

export interface IStackedGroup {
	label: string;
	parts: {label: string; value: number; color: string}[];
}

/** Стопки по категориям (например, победы Нечто/людей по числу игроков). */
export const stackedColumns = ({groups, height = 220}: {groups: IStackedGroup[]; height?: number}): SVGElement => {
	const width = Math.max(320, groups.length * 72);
	const plotWidth = width - AXIS.left - AXIS.right;
	const plotHeight = height - AXIS.top - AXIS.bottom;
	const max = Math.max(1, ...groups.map((group) => group.parts.reduce((sum, part) => sum + part.value, 0)));
	const ticks = niceTicks(max);
	const scaleMax = ticks[ticks.length - 1] ?? max;
	const band = plotWidth / Math.max(1, groups.length);
	const barWidth = Math.min(MARK.maxBar, band - 16);

	const root = svg('svg', {viewBox: `0 0 ${width} ${height}`, class: 'chart chart--stack', role: 'img'});

	for (const tick of ticks) {
		const y = AXIS.top + plotHeight - (tick / scaleMax) * plotHeight;
		root.appendChild(svg('line', {x1: AXIS.left, x2: width - AXIS.right, y1: y, y2: y, stroke: COLORS.grid}));
		const text = svg('text', {x: AXIS.left - 8, y: y + 4, 'text-anchor': 'end', class: 'axis-text'});
		text.textContent = num(tick);
		root.appendChild(text);
	}

	groups.forEach((group, index) => {
		const x = AXIS.left + index * band + (band - barWidth) / 2;
		let bottom = AXIS.top + plotHeight;
		group.parts.forEach((part) => {
			if (part.value <= 0) return;
			const rawHeight = (part.value / scaleMax) * plotHeight;
			const segmentHeight = Math.max(2, rawHeight - MARK.gap);
			const y = bottom - segmentHeight;
			const rect = svg('rect', {x, y, width: barWidth, height: segmentHeight, fill: part.color, rx: 2});
			withTooltip(rect, `<b>${escapeHtml(group.label)}</b><br>${escapeHtml(part.label)}: ${num(part.value)}`);
			root.appendChild(rect);
			bottom -= rawHeight;
		});
		const label = svg('text', {x: x + barWidth / 2, y: height - 10, 'text-anchor': 'middle', class: 'axis-text'});
		label.textContent = group.label;
		root.appendChild(label);
	});

	return root;
};

// Столбик: скруглён сверху (конец данных), квадратный у базовой линии.
const roundedTopBar = (x: number, y: number, width: number, height: number, radius: number): string => {
	const r = Math.min(radius, width / 2, height);
	return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
};

export const escapeHtml = (value: string): string =>
	value.replace(/[&<>"]/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[char] ?? char);
