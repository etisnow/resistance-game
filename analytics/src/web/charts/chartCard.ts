import {el} from 'analytics/web/dom';

// Обёртка любого графика: заголовок, легенда, сам рисунок и переключатель
// «таблица». Таблица не украшение — это доступный дубль тех же чисел для тех,
// кому цвет не читается (и для тех, кто хочет скопировать значения).

export interface ILegendItem {
	label: string;
	color: string;
	shape?: 'square' | 'line';
}

export interface IChartCardOptions {
	title: string;
	subtitle?: string;
	legend?: ILegendItem[];
	/** Рисунок графика. */
	render: () => HTMLElement | SVGElement;
	/** Те же данные таблицей: [заголовки, строки]. */
	table?: {head: string[]; rows: (string | number)[][]};
	wide?: boolean;
}

export const chartCard = ({title, subtitle, legend, render, table, wide}: IChartCardOptions): HTMLElement => {
	const body = el('div', {class: 'chart-body'});
	let showTable = false;

	const draw = () => {
		body.replaceChildren();
		if (showTable && table) {
			body.appendChild(renderTable(table));
			return;
		}
		body.appendChild(render() as HTMLElement);
	};

	const toggle = table
		? el('button', {
				class: 'chart-toggle',
				text: 'таблица',
				onclick: (event) => {
					showTable = !showTable;
					(event.currentTarget as HTMLButtonElement).textContent = showTable ? 'график' : 'таблица';
					draw();
				},
			})
		: null;

	const card = el('section', {class: `card${wide ? ' card--wide' : ''}`}, [
		el('header', {class: 'card-head'}, [
			el('div', {}, [el('h3', {class: 'card-title', text: title}), subtitle ? el('p', {class: 'card-sub', text: subtitle}) : null]),
			toggle,
		]),
		legend && legend.length > 1 ? renderLegend(legend) : null,
		body,
	]);
	draw();
	return card;
};

export const renderLegend = (items: ILegendItem[]): HTMLElement =>
	el(
		'ul',
		{class: 'legend'},
		items.map((item) =>
			el('li', {class: 'legend-item'}, [
				el('span', {
					class: `legend-key legend-key--${item.shape ?? 'square'}`,
					style: `background:${item.color}`,
				}),
				el('span', {text: item.label}),
			]),
		),
	);

const renderTable = ({head, rows}: {head: string[]; rows: (string | number)[][]}): HTMLElement =>
	el('div', {class: 'table-wrap'}, [
		el('table', {class: 'data-table'}, [
			el('thead', {}, [el('tr', {}, head.map((cell) => el('th', {text: cell})))]),
			el(
				'tbody',
				{},
				rows.map((row) => el('tr', {}, row.map((cell) => el('td', {text: String(cell)})))),
			),
		]),
	]);

// ------------------------------------------------------------ подсказка

let tooltipNode: HTMLElement | null = null;

/** Общая всплывающая подсказка: одна на страницу, двигается за курсором. */
export const tooltip = () => {
	if (!tooltipNode) {
		tooltipNode = el('div', {class: 'tooltip'});
		document.body.appendChild(tooltipNode);
	}
	const node = tooltipNode;
	return {
		show(event: MouseEvent, html: string) {
			node.innerHTML = html;
			node.classList.add('is-visible');
			this.move(event);
		},
		move(event: MouseEvent) {
			const padding = 14;
			const {innerWidth, innerHeight} = window;
			const rect = node.getBoundingClientRect();
			const left = Math.min(event.clientX + padding, innerWidth - rect.width - padding);
			const top = Math.min(event.clientY + padding, innerHeight - rect.height - padding);
			node.style.transform = `translate(${Math.max(padding, left)}px, ${Math.max(padding, top)}px)`;
		},
		hide() {
			node.classList.remove('is-visible');
		},
	};
};

/** Навесить подсказку на марку. Область наведения — сама марка. */
export const withTooltip = (node: SVGElement | HTMLElement, html: string) => {
	const tip = tooltip();
	node.addEventListener('mouseenter', (event) => tip.show(event as MouseEvent, html));
	node.addEventListener('mousemove', (event) => tip.move(event as MouseEvent));
	node.addEventListener('mouseleave', () => tip.hide());
	return node;
};
