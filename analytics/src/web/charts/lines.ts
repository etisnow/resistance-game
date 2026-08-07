import {svg} from 'analytics/web/dom';
import {tooltip} from 'analytics/web/charts/chartCard';
import {AXIS, COLORS, MARK, niceTicks} from 'analytics/web/charts/theme';
import {escapeHtml} from 'analytics/web/charts/bars';
import {num, shortDate} from 'analytics/web/format';

export interface ISeries {
	label: string;
	color: string;
	points: number[];
}

/**
 * Линии по датам с общим прицелом: наведение ловит ближайшую дату и показывает
 * все ряды разом — так сравнение честнее, чем подсказка на отдельной точке.
 */
export const lineChart = ({
	labels,
	series,
	height = 240,
	valueFormat = num,
}: {
	labels: string[];
	series: ISeries[];
	height?: number;
	valueFormat?: (value: number) => string;
}): SVGElement => {
	const width = 720;
	const plotWidth = width - AXIS.left - AXIS.right;
	const plotHeight = height - AXIS.top - AXIS.bottom;
	const max = Math.max(1, ...series.flatMap((s) => s.points));
	const ticks = niceTicks(max);
	const scaleMax = ticks[ticks.length - 1] ?? max;
	const stepX = labels.length > 1 ? plotWidth / (labels.length - 1) : 0;

	const x = (index: number) => AXIS.left + (labels.length > 1 ? index * stepX : plotWidth / 2);
	const y = (value: number) => AXIS.top + plotHeight - (value / scaleMax) * plotHeight;

	const root = svg('svg', {viewBox: `0 0 ${width} ${height}`, class: 'chart chart--line', role: 'img'});

	for (const tick of ticks) {
		const ty = y(tick);
		root.appendChild(svg('line', {x1: AXIS.left, x2: width - AXIS.right, y1: ty, y2: ty, stroke: COLORS.grid}));
		const text = svg('text', {x: AXIS.left - 8, y: ty + 4, 'text-anchor': 'end', class: 'axis-text'});
		text.textContent = valueFormat(tick);
		root.appendChild(text);
	}

	// Подписи дат: показываем не все, иначе они наезжают друг на друга.
	const labelStep = Math.max(1, Math.ceil(labels.length / 8));
	labels.forEach((label, index) => {
		if (index % labelStep !== 0 && index !== labels.length - 1) return;
		const text = svg('text', {x: x(index), y: height - 8, 'text-anchor': 'middle', class: 'axis-text'});
		text.textContent = shortDate(label);
		root.appendChild(text);
	});

	for (const line of series) {
		const path = line.points.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(value)}`).join(' ');
		root.appendChild(
			svg('path', {
				d: path,
				fill: 'none',
				stroke: line.color,
				'stroke-width': MARK.line,
				'stroke-linejoin': 'round',
				'stroke-linecap': 'round',
			}),
		);
		// Конечная точка с кольцом цвета фона — она же метка ряда.
		const lastIndex = line.points.length - 1;
		const lastValue = line.points[lastIndex];
		if (lastValue !== undefined) {
			root.appendChild(
				svg('circle', {
					cx: x(lastIndex),
					cy: y(lastValue),
					r: MARK.dot,
					fill: line.color,
					stroke: COLORS.surface,
					'stroke-width': 2,
				}),
			);
		}
	}

	// Прицел: вертикальная линия и подсказка по ближайшей дате.
	const crosshair = svg('line', {
		x1: 0,
		x2: 0,
		y1: AXIS.top,
		y2: AXIS.top + plotHeight,
		stroke: COLORS.grid,
		'stroke-width': 1,
		opacity: 0,
	});
	root.appendChild(crosshair);

	const hitArea = svg('rect', {
		x: AXIS.left,
		y: AXIS.top,
		width: plotWidth,
		height: plotHeight,
		fill: 'transparent',
	});
	const tip = tooltip();
	hitArea.addEventListener('mousemove', (event) => {
		const mouse = event as MouseEvent;
		const rect = (root as SVGSVGElement).getBoundingClientRect();
		const ratio = (mouse.clientX - rect.left) / rect.width;
		const index = Math.max(0, Math.min(labels.length - 1, Math.round((ratio * width - AXIS.left) / (stepX || 1))));
		crosshair.setAttribute('opacity', '1');
		crosshair.setAttribute('x1', String(x(index)));
		crosshair.setAttribute('x2', String(x(index)));
		const rows = series
			.map(
				(line) =>
					`<span class="tip-key" style="background:${line.color}"></span>${escapeHtml(line.label)}: ${valueFormat(line.points[index] ?? 0)}`,
			)
			.join('<br>');
		tip.show(mouse, `<b>${escapeHtml(labels[index] ?? '')}</b><br>${rows}`);
	});
	hitArea.addEventListener('mouseleave', () => {
		crosshair.setAttribute('opacity', '0');
		tip.hide();
	});
	root.appendChild(hitArea);

	return root;
};
