import {el} from 'analytics/web/dom';
import {api} from 'analytics/web/api';
import {chartCard} from 'analytics/web/charts/chartCard';
import {barChart, columnChart, splitBar, stackedColumns} from 'analytics/web/charts/bars';
import {lineChart} from 'analytics/web/charts/lines';
import {COLORS, SIDE_COLORS} from 'analytics/web/charts/theme';
import {cardLabel, compact, deathLabel, duration, markLabel, num, pct, viaLabel} from 'analytics/web/format';
import {statTile, sectionTitle, heroFigure} from 'analytics/web/pages/parts';

/**
 * Обзор — полностью обезличенная витрина: ни одного ника. Это та страница,
 * которую можно показывать кому угодно, ничего не рассказывая про конкретных
 * людей за столом.
 */
export const overviewPage = async (): Promise<HTMLElement> => {
	const data = await api.overview();
	const {totals, winners} = data;
	const decided = winners.thing + winners.humans;

	const page = el('div', {class: 'page'});

	page.appendChild(
		el('section', {class: 'hero'}, [
			heroFigure(pct(decided ? winners.thing / decided : 0), 'партий забрало Нечто'),
			el('div', {class: 'hero-side'}, [
				el('p', {
					class: 'hero-text',
					text: `${num(totals.matches)} партий · ${num(totals.players)} игроков · ${num(totals.events)} событий за столом. Средняя партия — ${duration(totals.avgDurationMs)} и ${totals.avgTurns} ходов.`,
				}),
			]),
		]),
	);

	page.appendChild(
		el('div', {class: 'tiles'}, [
			statTile('Партий сыграно', num(totals.matches), `доиграно ${num(totals.completed)}`),
			statTile('Победы Нечто', num(winners.thing), decided ? pct(winners.thing / decided) : '—'),
			statTile('Победы людей', num(winners.humans), decided ? pct(winners.humans / decided) : '—'),
			statTile('Средняя длительность', duration(totals.avgDurationMs), `${totals.avgPlayers} игроков в среднем`),
			statTile('Статусов проставлено', num(totals.marks), `точность ${pct(data.markAccuracy.rate)}`),
			statTile('Заражений', num(data.infections.total), `${data.infections.perMatch} за партию`),
		]),
	);

	page.appendChild(sectionTitle('Кто выигрывает'));

	const grid = el('div', {class: 'grid'});
	page.appendChild(grid);

	grid.appendChild(
		chartCard({
			title: 'Исход партий',
			subtitle: 'Доля побед каждой стороны за всё время',
			legend: [
				{label: 'Нечто', color: SIDE_COLORS.thing},
				{label: 'Люди', color: SIDE_COLORS.humans},
			],
			render: () =>
				splitBar({
					segments: [
						{label: 'Нечто', value: winners.thing, color: SIDE_COLORS.thing},
						{label: 'Люди', value: winners.humans, color: SIDE_COLORS.humans},
					],
				}),
			table: {
				head: ['Сторона', 'Побед', 'Доля'],
				rows: [
					['Нечто', winners.thing, decided ? pct(winners.thing / decided) : '—'],
					['Люди', winners.humans, decided ? pct(winners.humans / decided) : '—'],
				],
			},
			wide: true,
		}),
	);

	grid.appendChild(
		chartCard({
			title: 'Победы по числу игроков',
			subtitle: 'За сколькими столами Нечто справлялось',
			legend: [
				{label: 'Нечто', color: SIDE_COLORS.thing},
				{label: 'Люди', color: SIDE_COLORS.humans},
			],
			render: () =>
				stackedColumns({
					groups: data.winRateByPlayerCount.map((row) => ({
						label: `${row.playerCount}`,
						parts: [
							{label: 'Нечто', value: row.thing, color: SIDE_COLORS.thing},
							{label: 'Люди', value: row.humans, color: SIDE_COLORS.humans},
						],
					})),
				}),
			table: {
				head: ['Игроков', 'Нечто', 'Люди'],
				rows: data.winRateByPlayerCount.map((row) => [row.playerCount, row.thing, row.humans]),
			},
		}),
	);

	grid.appendChild(
		chartCard({
			title: 'Партии по дням',
			subtitle: 'Сколько играли и чем заканчивалось',
			legend: [
				{label: 'Нечто', color: SIDE_COLORS.thing, shape: 'line'},
				{label: 'Люди', color: SIDE_COLORS.humans, shape: 'line'},
			],
			render: () =>
				lineChart({
					labels: data.timeline.map((point) => point.date),
					series: [
						{label: 'Нечто', color: SIDE_COLORS.thing, points: data.timeline.map((p) => p.thing)},
						{label: 'Люди', color: SIDE_COLORS.humans, points: data.timeline.map((p) => p.humans)},
					],
				}),
			table: {
				head: ['Дата', 'Партий', 'Нечто', 'Люди'],
				rows: data.timeline.map((p) => [p.date, p.matches, p.thing, p.humans]),
			},
			wide: true,
		}),
	);

	page.appendChild(sectionTitle('Подозрения'));
	const marksGrid = el('div', {class: 'grid'});
	page.appendChild(marksGrid);

	marksGrid.appendChild(
		chartCard({
			title: 'Правота подозрений',
			subtitle: 'Статусы «Нечто», «заражён» и «чист» против того, кем цель была на самом деле',
			legend: [
				{label: 'Угадали', color: COLORS.good},
				{label: 'Ошиблись', color: COLORS.critical},
			],
			render: () =>
				splitBar({
					segments: [
						{label: 'Угадали', value: data.markAccuracy.correct, color: COLORS.good},
						{label: 'Ошиблись', value: data.markAccuracy.wrong, color: COLORS.critical},
					],
				}),
			table: {
				head: ['Исход', 'Статусов'],
				rows: [
					['Угадали', data.markAccuracy.correct],
					['Ошиблись', data.markAccuracy.wrong],
				],
			},
			wide: true,
		}),
	);

	marksGrid.appendChild(
		chartCard({
			title: 'Какие статусы ставят',
			subtitle: 'Распределение по всем партиям',
			render: () =>
				columnChart({
					data: data.markDistribution.map((row) => ({label: markLabel(row.key), value: row.count})),
				}),
			table: {head: ['Статус', 'Раз'], rows: data.markDistribution.map((row) => [markLabel(row.key), row.count])},
		}),
	);

	marksGrid.appendChild(
		chartCard({
			title: 'Точность по типу статуса',
			subtitle: 'Насколько уверенно люди опознают заражённых',
			render: () =>
				barChart({
					data: data.markAccuracyByMark.map((row) => ({
						label: markLabel(row.mark),
						value: Math.round(row.rate * 100),
						tooltip: `<b>${markLabel(row.mark)}</b><br>верно ${row.correct} из ${row.total} · ${pct(row.rate)}`,
					})),
					valueFormat: (value) => `${value}%`,
				}),
			table: {
				head: ['Статус', 'Всего', 'Верно', 'Точность'],
				rows: data.markAccuracyByMark.map((row) => [markLabel(row.mark), row.total, row.correct, pct(row.rate)]),
			},
		}),
	);

	page.appendChild(sectionTitle('Что происходит за столом'));
	const tableGrid = el('div', {class: 'grid'});
	page.appendChild(tableGrid);

	tableGrid.appendChild(
		chartCard({
			title: 'Самые ходовые карты',
			subtitle: 'Сколько раз карту разыгрывали',
			render: () => barChart({data: data.cards.map((row) => ({label: cardLabel(row.key), value: row.count}))}),
			table: {head: ['Карта', 'Раз'], rows: data.cards.map((row) => [cardLabel(row.key), row.count])},
		}),
	);

	tableGrid.appendChild(
		chartCard({
			title: 'Паники',
			subtitle: 'Какие паники выпадали чаще',
			render: () => barChart({data: data.panics.map((row) => ({label: cardLabel(row.key), value: row.count}))}),
			table: {head: ['Паника', 'Раз'], rows: data.panics.map((row) => [cardLabel(row.key), row.count])},
		}),
	);

	tableGrid.appendChild(
		chartCard({
			title: 'Отчего выбывают',
			subtitle: 'Причины смерти за всё время',
			render: () => barChart({data: data.deaths.map((row) => ({label: deathLabel(row.key), value: row.count}))}),
			table: {head: ['Причина', 'Раз'], rows: data.deaths.map((row) => [deathLabel(row.key), row.count])},
		}),
	);

	tableGrid.appendChild(
		chartCard({
			title: 'Как передаётся зараза',
			subtitle: 'Путь, которым «Заражение!» доходило до цели',
			render: () => barChart({data: data.infections.byVia.map((row) => ({label: viaLabel(row.key), value: row.count}))}),
			table: {head: ['Путь', 'Раз'], rows: data.infections.byVia.map((row) => [viaLabel(row.key), row.count])},
		}),
	);

	tableGrid.appendChild(
		chartCard({
			title: 'Длительность партий',
			subtitle: 'Сколько времени занимает одна игра',
			render: () => columnChart({data: data.durationBuckets.map((row) => ({label: row.key, value: row.count}))}),
			table: {head: ['Длительность', 'Партий'], rows: data.durationBuckets.map((row) => [row.key, row.count])},
		}),
	);

	tableGrid.appendChild(
		chartCard({
			title: 'Длина партий в ходах',
			subtitle: 'Сколько ходов успевают сделать',
			render: () =>
				columnChart({
					data: data.turnsBuckets.map((row) => ({label: row.key, value: row.count})),
					valueFormat: compact,
				}),
			table: {head: ['Ходов', 'Партий'], rows: data.turnsBuckets.map((row) => [row.key, row.count])},
		}),
	);

	return page;
};
