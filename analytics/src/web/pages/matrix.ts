import {el} from 'analytics/web/dom';
import {api} from 'analytics/web/api';
import {chartCard} from 'analytics/web/charts/chartCard';
import {heatmap} from 'analytics/web/charts/heatmap';
import {escapeHtml} from 'analytics/web/charts/bars';
import {pct} from 'analytics/web/format';
import {empty, sectionTitle} from 'analytics/web/pages/parts';

type TMetric = 'marks' | 'accusations' | 'wrong';

/**
 * Матрица «кто кого подозревал». Главная картинка про отношения в компании:
 * строка — кто ставил статус, столбец — на кого.
 */
export const matrixPage = async (): Promise<HTMLElement> => {
	const data = await api.matrix();
	const page = el('div', {class: 'page'});
	page.appendChild(sectionTitle('Матрица подозрений'));

	if (data.players.length === 0) {
		page.appendChild(empty('Пока некого сравнивать — сыграйте несколько партий.'));
		return page;
	}

	let metric: TMetric = 'marks';
	const holder = el('div', {});

	const render = () => {
		holder.replaceChildren();
		holder.appendChild(
			chartCard({
				title: TITLES[metric],
				subtitle: 'Строка — кто ставил статус, столбец — на кого',
				render: () =>
					heatmap({
						rows: data.players.map((player) => ({key: player.key, label: player.displayName})),
						columns: data.players.map((player) => ({key: player.key, label: player.displayName})),
						rowLabel: 'кто',
						columnLabel: 'на кого',
						cells: data.cells.map((cell) => ({
							row: cell.actor,
							column: cell.target,
							value: metric === 'marks' ? cell.marks : metric === 'accusations' ? cell.accusations : cell.wrong,
							tooltip: `<b>${escapeHtml(name(data.players, cell.actor))} → ${escapeHtml(name(data.players, cell.target))}</b><br>статусов ${cell.marks}, обвинений ${cell.accusations}<br>верно ${cell.correct}, мимо ${cell.wrong}${
								cell.correct + cell.wrong ? ` · точность ${pct(cell.correct / (cell.correct + cell.wrong))}` : ''
							}`,
						})),
					}),
				table: {
					head: ['Кто', 'На кого', 'Статусов', 'Обвинений', 'Верно', 'Мимо'],
					rows: data.cells.map((cell) => [
						name(data.players, cell.actor),
						name(data.players, cell.target),
						cell.marks,
						cell.accusations,
						cell.correct,
						cell.wrong,
					]),
				},
				wide: true,
			}),
		);
	};

	const controls = el('div', {class: 'controls'}, [
		el('span', {class: 'controls-label', text: 'Показать:'}),
		...(
			[
				['marks', 'все статусы'],
				['accusations', 'только обвинения'],
				['wrong', 'ошибочные статусы'],
			] as [TMetric, string][]
		).map(([key, label]) =>
			el('button', {
				class: `chip${key === metric ? ' is-active' : ''}`,
				text: label,
				onclick: (event) => {
					metric = key;
					for (const chip of controls.querySelectorAll('.chip')) chip.classList.remove('is-active');
					(event.currentTarget as HTMLElement).classList.add('is-active');
					render();
				},
			}),
		),
	]);

	page.appendChild(controls);
	page.appendChild(holder);
	render();
	return page;
};

const TITLES: Record<TMetric, string> = {
	marks: 'Сколько статусов ставили друг на друга',
	accusations: 'Сколько раз обвиняли («Нечто» и «заражён»)',
	wrong: 'Сколько раз ошибались друг в друге',
};

const name = (players: {key: string; displayName: string}[], key: string): string =>
	players.find((player) => player.key === key)?.displayName ?? key;
