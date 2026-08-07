import {el} from 'analytics/web/dom';
import {api} from 'analytics/web/api';
import {link} from 'analytics/web/router';
import {empty, sectionTitle} from 'analytics/web/pages/parts';

/** Титулы: та самая «фановая» часть, ради которой всё и собиралось. */
export const awardsPage = async (): Promise<HTMLElement> => {
	const awards = await api.awards();
	const page = el('div', {class: 'page'});
	page.appendChild(sectionTitle('Титулы'));
	if (awards.length === 0) {
		page.appendChild(empty('Титулы появятся, когда наберётся несколько партий.'));
		return page;
	}
	page.appendChild(
		el(
			'div',
			{class: 'award-grid'},
			awards.map((award) =>
				el('a', {class: 'award-card', href: link(`player/${encodeURIComponent(award.playerKey)}`)}, [
					el('span', {class: 'award-card-title', text: award.title}),
					el('span', {class: 'award-card-name', text: award.playerName}),
					el('span', {class: 'award-card-value', text: `${award.value} ${award.unit}`}),
					el('span', {class: 'award-card-desc', text: award.description}),
				]),
			),
		),
	);
	return page;
};
