import {el} from 'analytics/web/dom';
import {api} from 'analytics/web/api';
import {chartCard} from 'analytics/web/charts/chartCard';
import {barChart, splitBar} from 'analytics/web/charts/bars';
import {lineChart} from 'analytics/web/charts/lines';
import {COLORS, SIDE_COLORS} from 'analytics/web/charts/theme';
import {cardLabel, dateOnly, deathLabel, duration, markLabel, num, pct, roleLabel, winnerLabel} from 'analytics/web/format';
import {empty, matchLink, sectionTitle, statTile, table} from 'analytics/web/pages/parts';
import type {IRoute} from 'analytics/web/router';

/** Досье игрока: всё, что известно про конкретный ник. */
export const playerPage = async (route: IRoute): Promise<HTMLElement> => {
	const data = await api.player(route.param);
	const {summary} = data;
	const page = el('div', {class: 'page'});

	page.appendChild(
		el('header', {class: 'profile'}, [
			el('h1', {class: 'profile-name', text: summary.displayName}),
			el('p', {
				class: 'profile-sub',
				text: `${num(summary.matches)} партий · ${num(summary.wins)} побед · с ${dateOnly(summary.firstSeen)}`,
			}),
			data.awards.length
				? el(
						'ul',
						{class: 'awards'},
						data.awards.map((award) =>
							el('li', {class: 'award', title: award.description}, [
								el('span', {class: 'award-title', text: award.title}),
								el('span', {class: 'award-value', text: `${award.value} ${award.unit}`}),
							]),
						),
					)
				: null,
		]),
	);

	page.appendChild(
		el('div', {class: 'tiles'}, [
			statTile('Процент побед', pct(summary.winRate), `${summary.wins} из ${summary.matches}`),
			statTile(
				'За Нечто',
				summary.asThing.matches ? pct(summary.asThing.winRate) : '—',
				`${summary.asThing.wins} побед в ${summary.asThing.matches} партиях`,
			),
			statTile('Дожил до конца', pct(summary.survivalRate), `${summary.survived} раз`),
			statTile('Точность подозрений', summary.markAccuracy.total ? pct(summary.markAccuracy.rate) : '—', `${summary.markAccuracy.total} оценённых статусов`),
			statTile('Сжёг игроков', num(summary.kills), `из них Нечто — ${summary.thingKills}`),
			statTile('Обвиняли зря', num(summary.timesWronglyAccused), `всего обвинений — ${summary.timesAccused}`),
		]),
	);

	page.appendChild(sectionTitle('Подозрения'));
	const grid = el('div', {class: 'grid'});
	page.appendChild(grid);

	grid.appendChild(
		chartCard({
			title: 'Насколько он прав',
			subtitle: 'Все его статусы против правды на тот момент',
			legend: [
				{label: 'Угадал', color: COLORS.good},
				{label: 'Ошибся', color: COLORS.critical},
			],
			render: () =>
				splitBar({
					segments: [
						{label: 'Угадал', value: summary.markAccuracy.correct, color: COLORS.good},
						{label: 'Ошибся', value: summary.markAccuracy.wrong, color: COLORS.critical},
					],
				}),
			table: {
				head: ['Исход', 'Статусов'],
				rows: [
					['Угадал', summary.markAccuracy.correct],
					['Ошибся', summary.markAccuracy.wrong],
				],
			},
			wide: true,
		}),
	);

	grid.appendChild(
		chartCard({
			title: 'Кого он подозревал',
			subtitle: 'Сколько статусов повесил на каждого',
			render: () =>
				barChart({
					data: data.suspected.map((row) => ({
						label: row.displayName,
						value: row.marks,
						tooltip: `<b>${row.displayName}</b><br>статусов ${row.marks}, обвинений ${row.accusations}<br>верно ${row.correct}, мимо ${row.wrong}`,
					})),
				}),
			table: {
				head: ['Игрок', 'Статусов', 'Обвинений', 'Верно', 'Мимо'],
				rows: data.suspected.map((row) => [row.displayName, row.marks, row.accusations, row.correct, row.wrong]),
			},
		}),
	);

	grid.appendChild(
		chartCard({
			title: 'Кто подозревал его',
			subtitle: 'И насколько эти подозрения оправдались',
			render: () =>
				barChart({
					data: data.suspectedBy.map((row) => ({
						label: row.displayName,
						value: row.marks,
						color: COLORS.critical,
						tooltip: `<b>${row.displayName}</b><br>статусов ${row.marks}, обвинений ${row.accusations}<br>верно ${row.correct}, мимо ${row.wrong}`,
					})),
				}),
			table: {
				head: ['Игрок', 'Статусов', 'Обвинений', 'Верно', 'Мимо'],
				rows: data.suspectedBy.map((row) => [row.displayName, row.marks, row.accusations, row.correct, row.wrong]),
			},
		}),
	);

	if (data.marksByType.length) {
		grid.appendChild(
			chartCard({
				title: 'В каком статусе он ошибается',
				subtitle: 'Точность отдельно по каждому типу метки',
				legend: [
					{label: 'Угадал', color: COLORS.good},
					{label: 'Ошибся', color: COLORS.critical},
				],
				render: () =>
					el(
						'div',
						{class: 'marktypes'},
						data.marksByType.map((row) =>
							el('div', {class: 'marktype'}, [
								el('div', {class: 'marktype-head'}, [
									el('span', {class: 'marktype-name', text: markLabel(row.mark)}),
									el('span', {
										class: 'marktype-value',
										// «Под вопросом» и снятие метки мнением не считаются — у них
										// нечего оценивать, и процент был бы выдумкой.
										text: row.judged ? `${pct(row.rate)} · ${row.correct} из ${row.judged}` : `${row.placed} раз, не оценивается`,
									}),
								]),
								row.judged
									? splitBar({
											height: 26,
											compact: true,
											segments: [
												{label: 'Угадал', value: row.correct, color: COLORS.good},
												{label: 'Ошибся', value: row.wrong, color: COLORS.critical},
											],
										})
									: el('div', {class: 'marktype-empty'}),
							]),
						),
					),
				table: {
					head: ['Статус', 'Ставил', 'Оценено', 'Верно', 'Мимо', 'Точность'],
					rows: data.marksByType.map((row) => [
						markLabel(row.mark),
						row.placed,
						row.judged,
						row.correct,
						row.wrong,
						row.judged ? pct(row.rate) : '—',
					]),
				},
				wide: true,
			}),
		);
	}

	if (data.accuracyTimeline.length > 1) {
		grid.appendChild(
			chartCard({
				title: 'Прозрение со временем',
				subtitle: 'Точность его статусов по дням',
				render: () =>
					lineChart({
						labels: data.accuracyTimeline.map((point) => point.date),
						series: [
							{
								label: 'Точность',
								color: COLORS.series1,
								points: data.accuracyTimeline.map((point) => Math.round(point.rate * 100)),
							},
						],
						valueFormat: (value) => `${value}%`,
					}),
				table: {
					head: ['Дата', 'Статусов', 'Точность'],
					rows: data.accuracyTimeline.map((point) => [point.date, point.total, pct(point.rate)]),
				},
				wide: true,
			}),
		);
	}

	page.appendChild(sectionTitle('Стиль игры'));
	const styleGrid = el('div', {class: 'grid'});
	page.appendChild(styleGrid);

	styleGrid.appendChild(
		chartCard({
			title: 'Любимые карты',
			subtitle: 'Что он разыгрывает чаще всего',
			render: () => barChart({data: data.cards.map((row) => ({label: cardLabel(row.key), value: row.count}))}),
			table: {head: ['Карта', 'Раз'], rows: data.cards.map((row) => [cardLabel(row.key), row.count])},
		}),
	);

	styleGrid.appendChild(
		chartCard({
			title: 'Любимые цели',
			subtitle: 'На кого он чаще всего играет карты',
			render: () => barChart({data: data.targets.map((row) => ({label: row.key, value: row.count}))}),
			table: {head: ['Игрок', 'Раз'], rows: data.targets.map((row) => [row.key, row.count])},
		}),
	);

	if (data.deaths.length) {
		styleGrid.appendChild(
			chartCard({
				title: 'Как он погибал',
				render: () => barChart({data: data.deaths.map((row) => ({label: deathLabel(row.key), value: row.count}))}),
				table: {head: ['Причина', 'Раз'], rows: data.deaths.map((row) => [deathLabel(row.key), row.count])},
			}),
		);
	}

	page.appendChild(sectionTitle('Партии'));
	page.appendChild(
		data.matches.length
			? table(
					['Когда', 'Роль', 'Исход', 'Итог', 'Дожил', 'Игроков', 'Длительность'],
					data.matches.map((match) => [
						matchLink(match.matchId, dateOnly(match.startedAt)),
						roleLabel(match.role),
						winnerLabel(match.winner),
						match.isWinner ? 'победа' : 'поражение',
						match.survived ? 'да' : 'нет',
						match.playerCount,
						duration(match.durationMs),
					]),
				)
			: empty('Партий нет'),
	);

	page.appendChild(
		el('p', {
			class: 'footnote',
			text: 'Заражённый человек играет за Нечто, поэтому его победа засчитана Нечто. Роли — на конец партии.',
		}),
	);

	page.appendChild(
		el('div', {class: 'side-stats'}, [
			el('h3', {text: 'Роли за столом'}),
			table(
				['Роль', 'Партий', 'Побед', '%'],
				[
					['Нечто', summary.asThing.matches, summary.asThing.wins, pct(summary.asThing.winRate)],
					['Заражённый', summary.asInfected.matches, summary.asInfected.wins, pct(summary.asInfected.winRate)],
					['Человек', summary.asHuman.matches, summary.asHuman.wins, pct(summary.asHuman.winRate)],
				],
			),
		]),
	);

	// Небольшая полоса «сторон» в подвале досье — для наглядности.
	page.appendChild(
		chartCard({
			title: 'В каких ролях он играл',
			legend: [
				{label: 'Нечто', color: SIDE_COLORS.thing},
				{label: 'Заражённый', color: COLORS.series3},
				{label: 'Человек', color: SIDE_COLORS.humans},
			],
			render: () =>
				splitBar({
					segments: [
						{label: 'Нечто', value: summary.asThing.matches, color: SIDE_COLORS.thing},
						{label: 'Заражённый', value: summary.asInfected.matches, color: COLORS.series3},
						{label: 'Человек', value: summary.asHuman.matches, color: SIDE_COLORS.humans},
					],
				}),
			table: {
				head: ['Роль', 'Партий'],
				rows: [
					['Нечто', summary.asThing.matches],
					['Заражённый', summary.asInfected.matches],
					['Человек', summary.asHuman.matches],
				],
			},
			wide: true,
		}),
	);

	return page;
};
