import {el} from 'analytics/web/dom';
import {api} from 'analytics/web/api';
import {cardLabel, dateTime, duration, eventLabel, endReasonLabel, markLabel, num, roleLabel, winnerLabel} from 'analytics/web/format';
import {empty, matchLink, playerLink, sectionTitle, table, verdictBadge} from 'analytics/web/pages/parts';
import type {IRoute} from 'analytics/web/router';
import {EAnalyticsEvent} from 'shared/analytics/contract';

/** Список партий. */
export const matchesPage = async (): Promise<HTMLElement> => {
	const {rows, total} = await api.matches(100);
	const page = el('div', {class: 'page'});
	page.appendChild(sectionTitle(`Партии (${num(total)})`));
	if (rows.length === 0) {
		page.appendChild(empty('Партий пока нет.'));
		return page;
	}
	page.appendChild(
		table(
			['Когда', 'Игроков', 'Ходов', 'Длительность', 'Победа', 'Чем кончилось', 'Нечто'],
			rows.map((row) => [
				matchLink(row.matchId, dateTime(row.startedAt)),
				row.playerCount,
				row.turns,
				duration(row.durationMs),
				winnerLabel(row.winner),
				endReasonLabel(row.endReason),
				row.thing ?? '—',
			]),
		),
	);
	return page;
};

/** Разбор одной партии: состав, лог и лента событий. */
export const matchPage = async (route: IRoute): Promise<HTMLElement> => {
	const data = await api.match(route.param);
	const page = el('div', {class: 'page'});

	page.appendChild(
		el('header', {class: 'profile'}, [
			el('h1', {class: 'profile-name', text: `Партия от ${dateTime(data.match.startedAt)}`}),
			el('p', {
				class: 'profile-sub',
				text: `${data.match.playerCount} игроков · ${data.match.turns} ходов · ${duration(data.match.durationMs)} · победа: ${winnerLabel(data.match.winner)} (${endReasonLabel(data.match.endReason)}) · сид ${data.seed}`,
			}),
		]),
	);

	page.appendChild(sectionTitle('За столом'));
	page.appendChild(
		table(
			['Место', 'Игрок', 'Роль', 'Итог', 'Дожил', 'Заразился на ходу'],
			data.players.map((player) => [
				player.seat + 1,
				playerLink(player.key, player.nickname),
				roleLabel(player.role),
				player.isWinner ? 'победа' : 'поражение',
				player.survived ? 'да' : 'нет',
				player.infectedAtTurn ?? '—',
			]),
		),
	);

	if (data.marks.length) {
		page.appendChild(sectionTitle('Кто что думал'));
		page.appendChild(
			table(
				['Ход', 'Кто', 'На кого', 'Статус', 'Правда?'],
				data.marks.map((mark) => [mark.turn, mark.actor, mark.target, markLabel(mark.mark), verdictBadge(mark.isCorrect)]),
			),
		);
	}

	page.appendChild(sectionTitle('Лента событий'));
	page.appendChild(
		el(
			'ol',
			{class: 'timeline'},
			data.events
				.filter((event) => event.type !== EAnalyticsEvent.cardDraw)
				.map((event) =>
					el('li', {class: `timeline-item timeline-item--${event.type}`}, [
						el('span', {class: 'timeline-turn', text: `ход ${event.turn}`}),
						el('span', {class: 'timeline-text', text: describe(event)}),
					]),
				),
		),
	);

	if (data.gameLog.length) {
		page.appendChild(sectionTitle('Игровой лог'));
		page.appendChild(
			el(
				'ol',
				{class: 'gamelog'},
				data.gameLog.map((line) => el('li', {class: `gamelog-line gamelog-line--${line.type}`, text: line.text})),
			),
		);
	}

	return page;
};

/** Человеческое описание события — то же, что игрок видел за столом. */
const describe = (event: {
	type: string;
	actor: string | null;
	target: string | null;
	cardId: string | null;
	detail: Record<string, unknown>;
}): string => {
	const actor = event.actor ?? 'кто-то';
	const target = event.target ?? '';
	const card = event.cardId ? cardLabel(event.cardId) : '';
	switch (event.type) {
		case EAnalyticsEvent.gameStart:
			return `Партия началась: ${String(event.detail.seats ?? '')}`;
		case EAnalyticsEvent.turnStart:
			return `Ходит ${actor}`;
		case EAnalyticsEvent.cardPlay:
			return target ? `${actor} играет «${card}» на ${target}` : `${actor} играет «${card}»`;
		case EAnalyticsEvent.cardDiscard:
			return `${actor} сбрасывает «${card}»`;
		case EAnalyticsEvent.tradeOffer:
			return `${actor} предлагает обмен игроку ${target}`;
		case EAnalyticsEvent.tradeComplete:
			return `${actor} и ${target} обменялись картами${event.detail.infectPassed ? ' (среди них было «Заражение!»)' : ''}`;
		case EAnalyticsEvent.tradeRefuse:
			return `${actor} отказывается от обмена с ${target} картой «${card}»`;
		case EAnalyticsEvent.panic:
			return `${actor} вытянул панику «${card}»`;
		case EAnalyticsEvent.infection:
			return event.actor ? `${actor} заразил ${target}` : `${target} заразился`;
		case EAnalyticsEvent.death:
			return `${target} выбывает (${String(event.detail.cause ?? 'иное')})${event.actor ? `, его сжёг ${actor}` : ''}`;
		case EAnalyticsEvent.quarantine:
			return `${actor} отправляет ${target} на карантин`;
		case EAnalyticsEvent.mark:
			return `${actor} помечает ${target}: «${markLabel(String(event.detail.mark ?? ''))}»`;
		case EAnalyticsEvent.decision:
			return `${actor} выбирает: ${String(event.detail.action ?? '')}`;
		case EAnalyticsEvent.gameEnd:
			return String(event.detail.endMessage ?? 'Партия закончена');
		default:
			return `${eventLabel(event.type)}: ${actor}${target ? ` → ${target}` : ''}`;
	}
};
