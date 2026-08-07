import {asc} from 'drizzle-orm';
import {players} from 'analytics/db/schema';
import {nicknameKey} from 'analytics/db/nicknames';
import type {TDb} from 'analytics/db/client';
import type {
	IFlamethrowerStats,
	IMatchDetail,
	IMatchRow,
	IMatrix,
	IPlayerDetail,
	IPlayerSummary,
} from 'analytics/shared/api';

/**
 * Обезличивание витрины.
 *
 * Компания может решить, что публично висит только сводная статистика, а кто
 * есть кто — их внутреннее дело. Тогда в админке выключается `showNicknames`, и
 * все ники в публичных ответах заменяются на устойчивые псевдонимы «Игрок N».
 * Ключи при этом остаются настоящими (ссылки не ломаются), но по ним нельзя
 * узнать человека, не зная его ника заранее.
 *
 * Обзор (`/api/overview`) обезличен всегда — там ников нет по построению.
 */
export interface IAnonymizer {
	enabled: boolean;
	name(key: string): string;
	byNickname(nickname: string | null): string | null;
}

export const buildAnonymizer = (db: TDb, enabled: boolean): IAnonymizer => {
	if (!enabled) {
		return {enabled: false, name: (key) => key, byNickname: (nickname) => nickname};
	}
	// Порядок по ключу, а не по числу партий: иначе псевдоним игрока менялся бы
	// после каждой партии, и «Игрок 3» из вчерашней ссылки был бы уже другим.
	const rows = db.select({key: players.key}).from(players).orderBy(asc(players.key)).all();
	const aliasByKey = new Map(rows.map((row, index) => [row.key, `Игрок ${index + 1}`]));
	const fallback = (key: string) => aliasByKey.get(key) ?? 'Игрок ?';
	return {
		enabled: true,
		name: fallback,
		byNickname: (nickname) => (nickname ? fallback(nicknameKey(nickname)) : nickname),
	};
};

export const anonymizePlayers = (rows: IPlayerSummary[], anon: IAnonymizer): IPlayerSummary[] =>
	anon.enabled ? rows.map((row) => ({...row, displayName: anon.name(row.key)})) : rows;

export const anonymizePlayerDetail = (detail: IPlayerDetail, anon: IAnonymizer): IPlayerDetail => {
	if (!anon.enabled) return detail;
	return {
		...detail,
		summary: {...detail.summary, displayName: anon.name(detail.summary.key)},
		suspected: detail.suspected.map((row) => ({...row, displayName: anon.name(row.key)})),
		suspectedBy: detail.suspectedBy.map((row) => ({...row, displayName: anon.name(row.key)})),
		// В «любимых целях» ключ — это ник цели, поэтому переводим через ник.
		targets: detail.targets.map((row) => ({...row, key: anon.byNickname(row.key) ?? row.key})),
		awards: detail.awards.map((award) => ({...award, playerName: anon.name(award.playerKey)})),
	};
};

export const anonymizeMatrix = (matrix: IMatrix, anon: IAnonymizer): IMatrix =>
	anon.enabled
		? {...matrix, players: matrix.players.map((row) => ({...row, displayName: anon.name(row.key)}))}
		: matrix;

export const anonymizeMatchRows = (rows: IMatchRow[], anon: IAnonymizer): IMatchRow[] =>
	anon.enabled
		? rows.map((row) => ({
				...row,
				thing: anon.byNickname(row.thing),
				players: row.players.map((nickname) => anon.byNickname(nickname) ?? nickname),
			}))
		: rows;

export const anonymizeMatchDetail = (detail: IMatchDetail, anon: IAnonymizer): IMatchDetail => {
	if (!anon.enabled) return detail;
	const name = (nickname: string | null) => anon.byNickname(nickname);
	return {
		...detail,
		match: anonymizeMatchRows([detail.match], anon)[0] ?? detail.match,
		players: detail.players.map((player) => ({...player, nickname: anon.name(player.key)})),
		events: detail.events.map((event) => ({...event, actor: name(event.actor), target: name(event.target)})),
		marks: detail.marks.map((row) => ({
			...row,
			actor: name(row.actor) ?? row.actor,
			target: name(row.target) ?? row.target,
		})),
		// Игровой лог — свободный текст с никами внутри; в обезличенном режиме его
		// проще не показывать вовсе, чем пытаться вычистить имена из фраз.
		gameLog: [],
	};
};

export const anonymizeFlamethrower = (stats: IFlamethrowerStats, anon: IAnonymizer): IFlamethrowerStats =>
	anon.enabled
		? {
				...stats,
				shooters: stats.shooters.map((row) => ({...row, displayName: anon.name(row.key)})),
				victims: stats.victims.map((row) => ({...row, displayName: anon.name(row.key)})),
				pairs: stats.pairs.map((row) => ({
					...row,
					shooter: anon.name(row.shooterKey),
					victim: anon.name(row.victimKey),
				})),
			}
		: stats;
