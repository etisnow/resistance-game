import {el} from 'analytics/web/dom';
import {link} from 'analytics/web/router';

// Мелкие повторяющиеся куски витрины.

/** Плитка со значением. Подпись — предложением, значение — крупно. */
export const statTile = (label: string, value: string, hint?: string): HTMLElement =>
	el('div', {class: 'tile'}, [
		el('span', {class: 'tile-label', text: label}),
		el('span', {class: 'tile-value', text: value}),
		hint ? el('span', {class: 'tile-hint', text: hint}) : null,
	]);

/** Главное число страницы. На вид — одно на экран. */
export const heroFigure = (value: string, caption: string): HTMLElement =>
	el('div', {class: 'hero-figure'}, [
		el('span', {class: 'hero-value', text: value}),
		el('span', {class: 'hero-caption', text: caption}),
	]);

export const sectionTitle = (text: string): HTMLElement => el('h2', {class: 'section-title', text});

export const playerLink = (key: string, name: string): HTMLElement =>
	el('a', {class: 'player-link', href: link(`player/${encodeURIComponent(key)}`), text: name});

export const matchLink = (id: string, text: string): HTMLElement =>
	el('a', {class: 'player-link', href: link(`match/${encodeURIComponent(id)}`), text});

export const empty = (text: string): HTMLElement => el('p', {class: 'empty', text});

/** Значок правоты: цвет + слово, чтобы смысл не держался на одном цвете. */
export const verdictBadge = (isCorrect: number | null): HTMLElement => {
	if (isCorrect === null) return el('span', {class: 'badge badge--neutral', text: 'не в счёт'});
	return isCorrect === 1
		? el('span', {class: 'badge badge--good', text: '✓ верно'})
		: el('span', {class: 'badge badge--bad', text: '✗ мимо'});
};

export const table = (head: string[], rows: (HTMLElement | string | number)[][]): HTMLElement =>
	el('div', {class: 'table-wrap'}, [
		el('table', {class: 'data-table'}, [
			el('thead', {}, [el('tr', {}, head.map((cell) => el('th', {text: cell})))]),
			el(
				'tbody',
				{},
				rows.map((row) =>
					el(
						'tr',
						{},
						row.map((cell) => el('td', {}, [typeof cell === 'object' ? cell : String(cell)])),
					),
				),
			),
		]),
	]);
