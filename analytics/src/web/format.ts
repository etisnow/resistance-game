import {cardNames} from 'shared/constant/cardNames';
import {EAnalyticsDeathCause, EAnalyticsEvent, EAnalyticsMark, EAnalyticsRole} from 'shared/analytics/contract';
import type {EEventID, EPanicID} from 'shared/enum/cards';

// Человеческие подписи. Названия карт берём из самой игры — они там уже
// написаны ровно так, как напечатаны на картах, и второй раз их заводить незачем.

export const cardLabel = (cardId: string): string => cardNames[cardId as EEventID | EPanicID] ?? cardId;

export const markLabel = (mark: string): string => {
	switch (mark) {
		case EAnalyticsMark.clear:
			return 'чист';
		case EAnalyticsMark.question:
			return 'под вопросом';
		case EAnalyticsMark.infected:
			return 'заражён';
		case EAnalyticsMark.thing:
			return 'Нечто';
		case EAnalyticsMark.none:
			return 'статус снят';
		default:
			return mark;
	}
};

export const roleLabel = (role: string | null): string => {
	switch (role) {
		case EAnalyticsRole.thing:
			return 'Нечто';
		case EAnalyticsRole.infected:
			return 'заражённый';
		case EAnalyticsRole.human:
			return 'человек';
		default:
			return '—';
	}
};

export const winnerLabel = (winner: string | null): string => {
	if (winner === 'thing') return 'Нечто';
	if (winner === 'humans') return 'Люди';
	return 'не доиграна';
};

export const deathLabel = (cause: string): string => {
	switch (cause) {
		case EAnalyticsDeathCause.flamethrower:
			return 'сожжён огнемётом';
		case EAnalyticsDeathCause.overinfect:
			return 'перезаражение';
		default:
			return 'иное';
	}
};

export const endReasonLabel = (reason: string): string => {
	switch (reason) {
		case 'thing_burned':
			return 'Нечто сожгли';
		case 'all_infected':
			return 'заражены все';
		case 'last_survivor':
			return 'остался один';
		case 'abandoned':
			return 'партию бросили';
		default:
			return reason;
	}
};

export const eventLabel = (type: string): string => {
	switch (type) {
		case EAnalyticsEvent.gameStart:
			return 'начало партии';
		case EAnalyticsEvent.turnStart:
			return 'ход';
		case EAnalyticsEvent.cardDraw:
			return 'взял карту';
		case EAnalyticsEvent.cardPlay:
			return 'сыграл карту';
		case EAnalyticsEvent.cardDiscard:
			return 'сбросил карту';
		case EAnalyticsEvent.tradeOffer:
			return 'предложил обмен';
		case EAnalyticsEvent.tradeComplete:
			return 'обмен состоялся';
		case EAnalyticsEvent.tradeRefuse:
			return 'отказ от обмена';
		case EAnalyticsEvent.panic:
			return 'паника';
		case EAnalyticsEvent.infection:
			return 'заражение';
		case EAnalyticsEvent.death:
			return 'смерть';
		case EAnalyticsEvent.quarantine:
			return 'карантин';
		case EAnalyticsEvent.mark:
			return 'статус';
		case EAnalyticsEvent.decision:
			return 'решение';
		case EAnalyticsEvent.gameEnd:
			return 'конец партии';
		default:
			return type;
	}
};

export const viaLabel = (via: string): string => {
	switch (via) {
		case 'trade':
			return 'через обмен';
		case 'chainReaction':
			return 'цепная реакция';
		default:
			return via;
	}
};

export const sourceLabel = (source: string): string => {
	switch (source) {
		case 'live':
			return 'живые игры';
		case 'bots':
			return 'с ботами';
		case 'e2e':
			return 'e2e-тесты';
		case 'test':
			return 'юнит-тесты';
		default:
			return source;
	}
};

// ------------------------------------------------------------------- числа

export const pct = (value: number, digits = 0): string => `${(value * 100).toFixed(digits)}%`;

export const num = (value: number): string => value.toLocaleString('ru-RU');

export const compact = (value: number): string => {
	if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	if (Math.abs(value) >= 10_000) return `${Math.round(value / 1000)}K`;
	return num(value);
};

export const duration = (ms: number): string => {
	const minutes = Math.round(ms / 60000);
	if (minutes < 60) return `${minutes} мин`;
	const hours = Math.floor(minutes / 60);
	return `${hours} ч ${minutes % 60} мин`;
};

export const dateTime = (ts: number): string =>
	new Date(ts).toLocaleString('ru-RU', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'});

export const dateOnly = (ts: number): string =>
	new Date(ts).toLocaleDateString('ru-RU', {day: '2-digit', month: 'short', year: 'numeric'});

export const shortDate = (iso: string): string => {
	const [, month, day] = iso.split('-');
	return `${day}.${month}`;
};
