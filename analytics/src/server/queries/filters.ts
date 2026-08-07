import {and, eq, gte, inArray, lte, type SQL} from 'drizzle-orm';
import {matches} from 'analytics/db/schema';
import {EAnalyticsSource} from 'shared/analytics/contract';
import type {IStatsFilters} from 'analytics/shared/api';

/**
 * По умолчанию витрина показывает только настоящие партии живых людей: игры с
 * ботами, e2e и юнит-тесты в общую статистику не идут, иначе «рейтинг игроков»
 * возглавит «Бот 3».
 */
export const defaultFilters = (): IStatsFilters => ({
	sources: [EAnalyticsSource.live],
	includeBots: false,
	includeIncomplete: false,
	from: null,
	to: null,
	minMatches: 1,
});

/** Разбор query-строки в фильтры. Всё необязательно. */
export const parseFilters = (url: URL): IStatsFilters => {
	const base = defaultFilters();
	const source = url.searchParams.get('source');
	if (source) {
		const wanted = source
			.split(',')
			.map((s) => s.trim())
			.filter((s) => (Object.values(EAnalyticsSource) as string[]).includes(s));
		if (wanted.length) base.sources = wanted;
		if (source === 'all') base.sources = Object.values(EAnalyticsSource);
	}
	if (url.searchParams.get('bots') === 'true') base.includeBots = true;
	if (url.searchParams.get('incomplete') === 'true') base.includeIncomplete = true;
	const from = Number(url.searchParams.get('from'));
	const to = Number(url.searchParams.get('to'));
	if (Number.isFinite(from) && from > 0) base.from = from;
	if (Number.isFinite(to) && to > 0) base.to = to;
	const minMatches = Number(url.searchParams.get('minMatches'));
	if (Number.isFinite(minMatches) && minMatches >= 0) base.minMatches = minMatches;
	return base;
};

/**
 * Условие «эту партию считаем». Спрятанные админом партии не видны нигде, кроме
 * админки — там фильтр не применяется.
 */
export const matchFilter = (filters: IStatsFilters): SQL => {
	const parts: (SQL | undefined)[] = [eq(matches.isHidden, 0)];
	parts.push(inArray(matches.source, filters.sources.length ? filters.sources : [EAnalyticsSource.live]));
	if (!filters.includeBots) parts.push(eq(matches.hasBots, 0));
	if (!filters.includeIncomplete) parts.push(eq(matches.isComplete, 1));
	if (filters.from !== null) parts.push(gte(matches.startedAt, filters.from));
	if (filters.to !== null) parts.push(lte(matches.startedAt, filters.to));
	const condition = and(...parts);
	// and() без условий вернул бы undefined — здесь их всегда минимум одно.
	return condition ?? eq(matches.isHidden, 0);
};

/** Отдельно: партии, по которым считаются победы (только доигранные). */
export const completedFilter = (filters: IStatsFilters): SQL =>
	and(matchFilter(filters), eq(matches.isComplete, 1)) ?? matchFilter(filters);
