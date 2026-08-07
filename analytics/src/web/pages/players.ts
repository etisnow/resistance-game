import {el} from 'analytics/web/dom';
import {api} from 'analytics/web/api';
import {chartCard} from 'analytics/web/charts/chartCard';
import {barChart} from 'analytics/web/charts/bars';
import {COLORS} from 'analytics/web/charts/theme';
import {num, pct} from 'analytics/web/format';
import {empty, playerLink, sectionTitle, table} from 'analytics/web/pages/parts';
import type {IPlayerSummary} from 'analytics/shared/api';

type TSortKey = 'matches' | 'winRate' | 'markAccuracy' | 'accusations' | 'kills' | 'timesWronglyAccused';

/** Рейтинг: одна строка на человека, сортировка по любому столбцу. */
export const playersPage = async (): Promise<HTMLElement> => {
	const rows = await api.players();
	const page = el('div', {class: 'page'});

	if (rows.length === 0) {
		page.appendChild(empty('Партий пока нет — сыграйте первую, и здесь появится рейтинг.'));
		return page;
	}

	let sortKey: TSortKey = 'matches';
	const body = el('div', {});

	const sorted = (key: TSortKey): IPlayerSummary[] =>
		[...rows].sort((a, b) => value(b, key) - value(a, key) || b.matches - a.matches);

	const render = () => {
		body.replaceChildren();
		body.appendChild(
			table(
				['Игрок', 'Партий', 'Побед', '% побед', 'За Нечто', 'Выжил', 'Сжёг', 'Обвинений', 'Точность', 'Зря обвиняли'],
				sorted(sortKey).map((player) => [
					playerLink(player.key, player.displayName),
					num(player.matches),
					num(player.wins),
					pct(player.winRate),
					player.asThing.matches ? `${player.asThing.wins}/${player.asThing.matches}` : '—',
					pct(player.survivalRate),
					num(player.kills),
					num(player.accusations),
					player.markAccuracy.total ? pct(player.markAccuracy.rate) : '—',
					num(player.timesWronglyAccused),
				]),
			),
		);
	};

	const controls = el('div', {class: 'controls'}, [
		el('span', {class: 'controls-label', text: 'Сортировать по:'}),
		...(
			[
				['matches', 'партиям'],
				['winRate', 'проценту побед'],
				['markAccuracy', 'точности подозрений'],
				['accusations', 'обвинениям'],
				['kills', 'сожжённым'],
				['timesWronglyAccused', 'ошибкам в свой адрес'],
			] as [TSortKey, string][]
		).map(([key, label]) =>
			el('button', {
				class: `chip${key === sortKey ? ' is-active' : ''}`,
				text: label,
				onclick: (event) => {
					sortKey = key;
					for (const chip of controls.querySelectorAll('.chip')) chip.classList.remove('is-active');
					(event.currentTarget as HTMLElement).classList.add('is-active');
					render();
				},
			}),
		),
	]);

	page.appendChild(sectionTitle('Рейтинг игроков'));
	page.appendChild(controls);
	page.appendChild(body);
	render();

	page.appendChild(sectionTitle('Кто прав, а кто нет'));
	const grid = el('div', {class: 'grid'});
	page.appendChild(grid);

	const withMarks = rows.filter((row) => row.markAccuracy.total >= 5);
	grid.appendChild(
		chartCard({
			title: 'Точность подозрений',
			subtitle: 'Доля верных статусов (у кого их хотя бы пять)',
			render: () =>
				barChart({
					data: [...withMarks]
						.sort((a, b) => b.markAccuracy.rate - a.markAccuracy.rate)
						.map((row) => ({
							label: row.displayName,
							value: Math.round(row.markAccuracy.rate * 100),
							color: COLORS.good,
							tooltip: `<b>${row.displayName}</b><br>верно ${row.markAccuracy.correct} из ${row.markAccuracy.total}`,
						})),
					valueFormat: (value) => `${value}%`,
				}),
			table: {
				head: ['Игрок', 'Статусов', 'Верно', 'Точность'],
				rows: withMarks.map((row) => [
					row.displayName,
					row.markAccuracy.total,
					row.markAccuracy.correct,
					pct(row.markAccuracy.rate),
				]),
			},
		}),
	);

	grid.appendChild(
		chartCard({
			title: 'Главные жертвы подозрений',
			subtitle: 'Сколько раз человека обвиняли зря',
			render: () =>
				barChart({
					data: [...rows]
						.sort((a, b) => b.timesWronglyAccused - a.timesWronglyAccused)
						.map((row) => ({
							label: row.displayName,
							value: row.timesWronglyAccused,
							color: COLORS.critical,
							tooltip: `<b>${row.displayName}</b><br>обвиняли ${row.timesAccused} раз, зря — ${row.timesWronglyAccused}`,
						})),
				}),
			table: {
				head: ['Игрок', 'Обвинений', 'Из них ошибочных'],
				rows: rows.map((row) => [row.displayName, row.timesAccused, row.timesWronglyAccused]),
			},
		}),
	);

	grid.appendChild(
		chartCard({
			title: 'Процент побед',
			subtitle: 'За всё время, во всех ролях',
			render: () =>
				barChart({
					data: [...rows]
						.sort((a, b) => b.winRate - a.winRate)
						.map((row) => ({
							label: row.displayName,
							value: Math.round(row.winRate * 100),
							tooltip: `<b>${row.displayName}</b><br>${row.wins} побед из ${row.matches}`,
						})),
					valueFormat: (value) => `${value}%`,
				}),
			table: {
				head: ['Игрок', 'Партий', 'Побед', '%'],
				rows: rows.map((row) => [row.displayName, row.matches, row.wins, pct(row.winRate)]),
			},
		}),
	);

	grid.appendChild(
		chartCard({
			title: 'Заражения',
			subtitle: 'Сколько раз игрок передал «Заражение!» дальше',
			render: () =>
				barChart({
					data: [...rows]
						.sort((a, b) => b.infectionsGiven - a.infectionsGiven)
						.map((row) => ({
							label: row.displayName,
							value: row.infectionsGiven,
							tooltip: `<b>${row.displayName}</b><br>передал ${row.infectionsGiven}, получил ${row.infectionsReceived}`,
						})),
				}),
			table: {
				head: ['Игрок', 'Передал', 'Получил'],
				rows: rows.map((row) => [row.displayName, row.infectionsGiven, row.infectionsReceived]),
			},
		}),
	);

	return page;
};

const value = (player: IPlayerSummary, key: TSortKey): number => {
	switch (key) {
		case 'matches':
			return player.matches;
		case 'winRate':
			return player.winRate;
		case 'markAccuracy':
			return player.markAccuracy.rate;
		case 'accusations':
			return player.accusations;
		case 'kills':
			return player.kills;
		case 'timesWronglyAccused':
			return player.timesWronglyAccused;
		default:
			return 0;
	}
};
