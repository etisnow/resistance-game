import './styles.css';
import {el} from 'analytics/web/dom';
import {api, setQuery, type IQuery} from 'analytics/web/api';
import {onRouteChange, link, type IRoute} from 'analytics/web/router';
import {overviewPage} from 'analytics/web/pages/overview';
import {playersPage} from 'analytics/web/pages/players';
import {playerPage} from 'analytics/web/pages/player';
import {matrixPage} from 'analytics/web/pages/matrix';
import {flamethrowerPage} from 'analytics/web/pages/flamethrower';
import {matchPage, matchesPage} from 'analytics/web/pages/matches';
import {awardsPage} from 'analytics/web/pages/awards';
import {adminPage} from 'analytics/web/pages/admin';
import {sourceLabel} from 'analytics/web/format';

// Точка входа витрины. Каркас, навигация, фильтры и переключатель темы; всё
// остальное живёт в страницах.

const NAV: {name: string; title: string}[] = [
	{name: 'overview', title: 'Обзор'},
	{name: 'players', title: 'Игроки'},
	{name: 'matrix', title: 'Матрица'},
	{name: 'flamethrower', title: 'Огнемёт'},
	{name: 'awards', title: 'Титулы'},
	{name: 'matches', title: 'Партии'},
	{name: 'admin', title: 'Админка'},
];

const PAGES: Record<string, (route: IRoute) => Promise<HTMLElement> | HTMLElement> = {
	overview: overviewPage,
	players: playersPage,
	player: playerPage,
	matrix: matrixPage,
	flamethrower: flamethrowerPage,
	awards: awardsPage,
	matches: matchesPage,
	match: matchPage,
	admin: adminPage,
};

// Фильтры витрины хранятся в localStorage: выбрал «показывать игры с ботами» —
// оно таким и осталось при следующем заходе.
const FILTER_KEY = 'nechto-analytics-filters';

const loadFilters = (): IQuery => {
	try {
		const raw = localStorage.getItem(FILTER_KEY);
		return raw ? (JSON.parse(raw) as IQuery) : {};
	} catch {
		return {};
	}
};

const saveFilters = (query: IQuery) => localStorage.setItem(FILTER_KEY, JSON.stringify(query));

const THEME_KEY = 'nechto-analytics-theme';

const applyTheme = (theme: string) => {
	document.documentElement.setAttribute('data-theme', theme);
	localStorage.setItem(THEME_KEY, theme);
};

const boot = async () => {
	const filters = loadFilters();
	setQuery(filters);
	applyTheme(localStorage.getItem(THEME_KEY) ?? 'dark');

	const root = document.getElementById('app');
	if (!root) return;

	const content = el('main', {class: 'content'});
	const title = el('h1', {class: 'brand-title', text: 'Нечто'});
	const subtitle = el('span', {class: 'brand-sub', text: 'исследовательский центр'});

	const nav = el(
		'nav',
		{class: 'nav'},
		NAV.map((item) => el('a', {class: 'nav-link', href: link(item.name), text: item.title, dataset: {nav: item.name}})),
	);

	const sourceSelect = el('select', {class: 'select'}) as HTMLSelectElement;
	const themeButton = el('button', {
		class: 'button button--ghost',
		text: 'тема',
		onclick: () => applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'),
	});

	const botsToggle = el('label', {class: 'toggle'}, [
		el('input', {
			type: 'checkbox',
			onchange: (event) => {
				filters.bots = (event.target as HTMLInputElement).checked;
				saveFilters(filters);
				setQuery(filters);
				render();
			},
		}),
		el('span', {text: 'считать игры с ботами'}),
	]);
	const botsInput = botsToggle.querySelector('input');
	if (botsInput instanceof HTMLInputElement) botsInput.checked = filters.bots === true;

	root.appendChild(
		el('header', {class: 'topbar'}, [
			el('a', {class: 'brand', href: link('overview')}, [title, subtitle]),
			nav,
			el('div', {class: 'topbar-tools'}, [sourceSelect, botsToggle, themeButton]),
		]),
	);
	root.appendChild(content);
	root.appendChild(
		el('footer', {class: 'footer'}, [
			el('span', {
				text: 'Статистика собирается автоматически по завершённым партиям. Во время игры наружу не уходит ничего.',
			}),
		]),
	);

	// Список источников заполняем по факту: пока играли только живьём, выбирать
	// не из чего — и лишний селект только мешает.
	try {
		const meta = await api.meta();
		document.title = meta.title;
		title.textContent = 'Нечто';
		subtitle.textContent = meta.title.replace(/^Нечто:\s*/i, '');
		const options = [{key: 'live', count: 0}, ...meta.sources.filter((source) => source.key !== 'live')];
		for (const source of options) {
			const option = document.createElement('option');
			option.value = source.key;
			option.textContent = sourceLabel(source.key);
			sourceSelect.appendChild(option);
		}
		const all = document.createElement('option');
		all.value = 'all';
		all.textContent = 'все источники';
		sourceSelect.appendChild(all);
		sourceSelect.value = filters.source ?? 'live';
		sourceSelect.addEventListener('change', () => {
			filters.source = sourceSelect.value;
			saveFilters(filters);
			setQuery(filters);
			render();
		});
	} catch (e) {
		console.error('[analytics] не удалось получить мету:', e);
	}

	let route: IRoute = {name: 'overview', param: ''};

	const render = async () => {
		for (const item of nav.querySelectorAll('.nav-link')) {
			item.classList.toggle('is-active', item.getAttribute('data-nav') === route.name);
		}
		content.replaceChildren(el('div', {class: 'loading', text: 'Считаю…'}));
		const page = PAGES[route.name] ?? PAGES.overview;
		try {
			const node = await page?.(route);
			content.replaceChildren(node ?? el('div', {text: 'Пусто'}));
			window.scrollTo({top: 0});
		} catch (e) {
			content.replaceChildren(
				el('div', {class: 'error'}, [
					el('h2', {text: 'Не получилось'}),
					el('p', {text: e instanceof Error ? e.message : String(e)}),
				]),
			);
		}
	};

	onRouteChange((next) => {
		route = next;
		void render();
	});
};

void boot();
