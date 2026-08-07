import {el} from 'analytics/web/dom';
import {api} from 'analytics/web/api';
import {chartCard} from 'analytics/web/charts/chartCard';
import {barChart, columnChart, splitBar} from 'analytics/web/charts/bars';
import {COLORS} from 'analytics/web/charts/theme';
import {num, pct} from 'analytics/web/format';
import {empty, heroFigure, playerLink, sectionTitle, statTile, table} from 'analytics/web/pages/parts';

/**
 * Огнемёт — отдельная страница: это единственное необратимое действие в игре, и
 * разбирают его дольше всего. Главный вопрос — был ли выстрел ошибкой:
 *
 *  • попал     — чистый человек сжёг заражённого или само Нечто;
 *  • ошибка    — чистый человек сжёг чистого: минус союзник;
 *  • по плану  — стрелял заражённый или Нечто; их выстрелы «правильностью» не
 *                судим, это их игра.
 */
export const flamethrowerPage = async (): Promise<HTMLElement> => {
	const data = await api.flamethrower();
	const {totals, burnsByVerdict, savesByVerdict} = data;
	const page = el('div', {class: 'page'});

	if (totals.attempts === 0) {
		page.appendChild(sectionTitle('Огнемёт'));
		page.appendChild(empty('Из огнемёта ещё никто не стрелял.'));
		return page;
	}

	const judged = burnsByVerdict.correct + burnsByVerdict.wrong;

	page.appendChild(
		el('section', {class: 'hero'}, [
			heroFigure(judged ? pct(burnsByVerdict.wrong / judged) : '—', 'сожжений оказались ошибкой'),
			el('div', {class: 'hero-side'}, [
				el('p', {
					class: 'hero-text',
					text:
						`${num(totals.attempts)} выстрелов: ${num(totals.burned)} закончились сожжением, ` +
						`${num(totals.saved)} отбили «Никаким шашлыком». Ошибкой считается выстрел чистого человека ` +
						`по чистому человеку — выстрелы заражённых сюда не идут, это их игра.`,
				}),
			]),
		]),
	);

	page.appendChild(
		el('div', {class: 'tiles'}, [
			statTile('Выстрелов', num(totals.attempts), `не доиграно ${totals.unresolved}`),
			statTile('Сожжено', num(totals.burned), `из них Нечто — ${totals.thingBurned}`),
			statTile('Спаслись шашлыком', num(totals.saved), `${pct(totals.saveRate)} выстрелов`),
			statTile('Ошибочных сожжений', num(burnsByVerdict.wrong), 'чистый сжёг чистого'),
			statTile('Верных сожжений', num(burnsByVerdict.correct), 'чистый сжёг заражённого'),
			statTile('Выстрелов по плану', num(burnsByVerdict.byPlan + savesByVerdict.byPlan), 'стрелял заражённый'),
		]),
	);

	page.appendChild(sectionTitle('Приговор выстрелам'));
	const grid = el('div', {class: 'grid'});
	page.appendChild(grid);

	const verdictLegend = [
		{label: 'Попал', color: COLORS.good},
		{label: 'Ошибка', color: COLORS.critical},
		{label: 'По плану', color: COLORS.series3},
	];

	grid.appendChild(
		chartCard({
			title: 'Чем закончились сожжения',
			subtitle: 'Кого именно сожгли и кем был стрелявший',
			legend: verdictLegend,
			render: () =>
				splitBar({
					segments: [
						{label: 'Попал', value: burnsByVerdict.correct, color: COLORS.good},
						{label: 'Ошибка', value: burnsByVerdict.wrong, color: COLORS.critical},
						{label: 'По плану', value: burnsByVerdict.byPlan, color: COLORS.series3},
					],
				}),
			table: {
				head: ['Приговор', 'Сожжений'],
				rows: [
					['Попал (чистый сжёг заражённого)', burnsByVerdict.correct],
					['Ошибка (чистый сжёг чистого)', burnsByVerdict.wrong],
					['По плану (стрелял заражённый)', burnsByVerdict.byPlan],
				],
			},
			wide: true,
		}),
	);

	grid.appendChild(
		chartCard({
			title: 'От чего спасал «Никакой шашлык»',
			subtitle: 'Тот же приговор, но выстрелам, которые отбили',
			legend: verdictLegend,
			render: () =>
				splitBar({
					segments: [
						{label: 'От верного', value: savesByVerdict.correct, color: COLORS.good},
						{label: 'От ошибочного', value: savesByVerdict.wrong, color: COLORS.critical},
						{label: 'От выстрела по плану', value: savesByVerdict.byPlan, color: COLORS.series3},
					],
				}),
			table: {
				head: ['От чего спаслись', 'Раз'],
				rows: [
					['От верного выстрела (спасся заражённый)', savesByVerdict.correct],
					['От ошибочного (спасся чистый)', savesByVerdict.wrong],
					['От выстрела заражённого', savesByVerdict.byPlan],
				],
			},
			wide: true,
		}),
	);

	grid.appendChild(
		chartCard({
			title: 'Когда стреляют',
			subtitle: 'На каком ходу случался выстрел',
			render: () => columnChart({data: data.turns.map((row) => ({label: row.key, value: row.count}))}),
			table: {head: ['Ход', 'Выстрелов'], rows: data.turns.map((row) => [row.key, row.count])},
		}),
	);

	page.appendChild(sectionTitle('Стрелки'));
	page.appendChild(
		table(
			['Игрок', 'Выстрелов', 'Сжёг', 'Отбили', 'Попал', 'Ошибся', 'По плану', 'Сжёг Нечто', 'Точность'],
			data.shooters.map((row) => [
				playerLink(row.key, row.displayName),
				row.shots,
				row.burned,
				row.saved,
				row.correct,
				row.wrong,
				row.byPlan,
				row.thingKills,
				row.correct + row.wrong ? pct(row.accuracy) : '—',
			]),
		),
	);

	const shootersGrid = el('div', {class: 'grid'});
	page.appendChild(shootersGrid);

	shootersGrid.appendChild(
		chartCard({
			title: 'Кто сжигал невиновных',
			subtitle: 'Чистый человек сжёг чистого человека',
			render: () =>
				barChart({
					data: [...data.shooters]
						.filter((row) => row.wrong > 0)
						.sort((a, b) => b.wrong - a.wrong)
						.map((row) => ({
							label: row.displayName,
							value: row.wrong,
							color: COLORS.critical,
							tooltip: `<b>${row.displayName}</b><br>ошибок ${row.wrong} из ${row.correct + row.wrong} судимых выстрелов`,
						})),
				}),
			table: {
				head: ['Игрок', 'Ошибок', 'Верных'],
				rows: data.shooters.map((row) => [row.displayName, row.wrong, row.correct]),
			},
		}),
	);

	shootersGrid.appendChild(
		chartCard({
			title: 'Точность огнемёта',
			subtitle: 'Доля верных среди судимых выстрелов (без выстрелов заражённых)',
			render: () =>
				barChart({
					data: [...data.shooters]
						.filter((row) => row.correct + row.wrong > 0)
						.sort((a, b) => b.accuracy - a.accuracy)
						.map((row) => ({
							label: row.displayName,
							value: Math.round(row.accuracy * 100),
							color: COLORS.good,
							tooltip: `<b>${row.displayName}</b><br>попал ${row.correct} из ${row.correct + row.wrong}`,
						})),
					valueFormat: (value) => `${value}%`,
				}),
			table: {
				head: ['Игрок', 'Судимых выстрелов', 'Попал', 'Точность'],
				rows: data.shooters.map((row) => [row.displayName, row.correct + row.wrong, row.correct, pct(row.accuracy)]),
			},
		}),
	);

	page.appendChild(sectionTitle('Мишени'));
	page.appendChild(
		table(
			['Игрок', 'В него целились', 'Сожгли', 'Отбился', 'Сожгли зря'],
			data.victims.map((row) => [
				playerLink(row.key, row.displayName),
				row.targeted,
				row.burned,
				row.saved,
				row.burnedWrongly,
			]),
		),
	);

	if (data.pairs.length) {
		// Пар с одним выстрелом набирается очень много, и таблица из них
		// перестаёт читаться. Показываем верх списка и честно говорим, сколько
		// осталось за кадром.
		const shownPairs = data.pairs.slice(0, 20);
		page.appendChild(sectionTitle('Кто в кого'));
		page.appendChild(
			table(
				['Стрелял', 'В кого', 'Выстрелов', 'Сжёг', 'Из них ошибочных'],
				shownPairs.map((row) => [
					playerLink(row.shooterKey, row.shooter),
					playerLink(row.victimKey, row.victim),
					row.shots,
					row.burned,
					row.wrong,
				]),
			),
		);
		if (data.pairs.length > shownPairs.length) {
			page.appendChild(
				el('p', {
					class: 'hint',
					text: `Показаны ${shownPairs.length} самых частых пар из ${data.pairs.length}; остальные — по одному-два выстрела.`,
				}),
			);
		}
	}

	page.appendChild(
		el('p', {
			class: 'footnote',
			text:
				'Роли берутся на момент выстрела: «он тогда ещё был чист» учитывается само собой. ' +
				'Выстрелы заражённых и Нечто не судим — сжечь своего ради алиби или чужого ради победы одинаково осмысленно.',
		}),
	);

	return page;
};
