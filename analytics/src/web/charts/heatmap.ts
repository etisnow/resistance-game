import {svg} from 'analytics/web/dom';
import {withTooltip} from 'analytics/web/charts/chartCard';
import {sequentialColor, sequentialInk} from 'analytics/web/charts/theme';
import {escapeHtml} from 'analytics/web/charts/bars';

export interface IHeatCell {
	row: string;
	column: string;
	value: number;
	tooltip?: string;
}

/**
 * Тепловая карта «кто на кого». Величина непрерывная, поэтому шкала
 * последовательная (один тон, светлее -> темнее), а не радужная.
 */
export const heatmap = ({
	rows,
	columns,
	cells,
	rowLabel,
	columnLabel,
}: {
	rows: {key: string; label: string}[];
	columns: {key: string; label: string}[];
	cells: IHeatCell[];
	rowLabel: string;
	columnLabel: string;
}): SVGElement => {
	const cellSize = 44;
	const labelWidth = 120;
	const headerHeight = 74;
	const width = labelWidth + columns.length * cellSize + 8;
	const height = headerHeight + rows.length * cellSize + 8;
	const max = Math.max(1, ...cells.map((cell) => cell.value));
	const byKey = new Map(cells.map((cell) => [`${cell.row}|${cell.column}`, cell]));

	const root = svg('svg', {viewBox: `0 0 ${width} ${height}`, class: 'chart chart--heat', role: 'img'});

	const corner = svg('text', {x: 4, y: headerHeight - 10, class: 'axis-text'});
	corner.textContent = `${rowLabel} ↓ / ${columnLabel} →`;
	root.appendChild(corner);

	columns.forEach((column, index) => {
		const x = labelWidth + index * cellSize + cellSize / 2;
		const text = svg('text', {
			x,
			y: headerHeight - 14,
			'text-anchor': 'start',
			class: 'axis-text',
			transform: `rotate(-45 ${x} ${headerHeight - 14})`,
		});
		text.textContent = column.label;
		root.appendChild(text);
	});

	rows.forEach((row, rowIndex) => {
		const y = headerHeight + rowIndex * cellSize;
		const label = svg('text', {x: labelWidth - 10, y: y + cellSize / 2 + 4, 'text-anchor': 'end', class: 'axis-text'});
		label.textContent = row.label;
		root.appendChild(label);

		columns.forEach((column, columnIndex) => {
			const x = labelWidth + columnIndex * cellSize;
			const cell = byKey.get(`${row.key}|${column.key}`);
			const value = cell?.value ?? 0;
			// Диагональ — сам на себя, такого не бывает: рисуем её нейтрально.
			const isSelf = row.key === column.key;
			const rect = svg('rect', {
				x: x + 1,
				y: y + 1,
				width: cellSize - 2,
				height: cellSize - 2,
				rx: 4,
				fill: isSelf ? 'var(--surface-2)' : sequentialColor(value, max),
			});
			if (!isSelf) {
				withTooltip(
					rect,
					cell?.tooltip ??
						`<b>${escapeHtml(row.label)} → ${escapeHtml(column.label)}</b><br>статусов: ${value}`,
				);
			}
			root.appendChild(rect);

			if (!isSelf && value > 0) {
				const text = svg('text', {
					x: x + cellSize / 2,
					y: y + cellSize / 2 + 4,
					'text-anchor': 'middle',
					class: 'cell-text',
					// Подпись внутри заливки: чернила подобраны под конкретную ступень шкалы.
					fill: sequentialInk(value, max),
				});
				text.textContent = String(value);
				root.appendChild(text);
			}
		});
	});

	return root;
};
