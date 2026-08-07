import {eq, sql} from 'drizzle-orm';
import {
	ANALYTICS_CONTRACT_VERSION,
	EAnalyticsEvent,
	type IAnalyticsEvent,
	type IAnalyticsIngestResult,
	type IAnalyticsMatch,
	type IAnalyticsMatchPlayer,
} from 'shared/analytics/contract';
import {events, marks, matchPlayers, matches, players} from 'analytics/db/schema';
import {AliasResolver} from 'analytics/db/nicknames';
import {buildMarkRows, type IMarkInput} from 'analytics/db/markRows';
import type {TDb} from 'analytics/db/client';

export class IngestError extends Error {}

/**
 * Приём партий от игрового сервера.
 *
 * Идемпотентно: `matchId` — первичный ключ, повторная доставка (ретрай сети,
 * ручной импорт спула) не создаёт дублей и не ломает статистику. Вся партия
 * пишется одной транзакцией — половинчатых партий в базе не бывает.
 */
export const ingestMatches = (db: TDb, payload: unknown): IAnalyticsIngestResult => {
	const parsed = parsePayload(payload);
	const resolver = AliasResolver.load(db);
	const result: IAnalyticsIngestResult = {accepted: 0, duplicates: 0, rejected: 0, errors: []};

	for (const raw of parsed.matches) {
		// Разбор каждой партии — внутри цикла: кривая партия в пачке не должна
		// утаскивать за собой остальные (пачки приходят из спула, где может
		// оказаться обрезанная строка).
		let match: IAnalyticsMatch;
		try {
			match = parseMatch(raw);
		} catch (e) {
			result.rejected += 1;
			result.errors?.push(e instanceof Error ? e.message : String(e));
			continue;
		}
		try {
			const exists = db.select({id: matches.matchId}).from(matches).where(eq(matches.matchId, match.matchId)).get();
			if (exists) {
				result.duplicates += 1;
				continue;
			}
			insertMatch(db, match, resolver);
			result.accepted += 1;
		} catch (e) {
			result.rejected += 1;
			result.errors?.push(`${match.matchId}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
	if (result.errors && result.errors.length === 0) delete result.errors;
	return result;
};

const insertMatch = (db: TDb, match: IAnalyticsMatch, resolver: AliasResolver) => {
	const now = Date.now();
	db.transaction((tx) => {
		tx.insert(matches)
			.values({
				matchId: match.matchId,
				seed: match.seed,
				source: match.source,
				startedAt: match.startedAt,
				endedAt: match.endedAt,
				durationMs: match.durationMs,
				playerCount: match.playerCount,
				turns: match.turns,
				winner: match.winner,
				endReason: match.endReason,
				endMessage: match.endMessage,
				isComplete: match.isComplete ? 1 : 0,
				hasBots: match.hasBots ? 1 : 0,
				isHidden: 0,
				gameLog: JSON.stringify(match.gameLog ?? []),
				ingestedAt: now,
			})
			.run();

		for (const player of match.players) {
			const key = resolver.resolve(player.nickname);
			upsertPlayer(tx, {key, player, match});
			tx.insert(matchPlayers)
				.values({
					matchId: match.matchId,
					playerKey: key,
					nickname: player.nickname,
					seat: player.seat,
					isBot: player.isBot ? 1 : 0,
					isThing: player.isThing ? 1 : 0,
					infectedAtEnd: player.infectedAtEnd ? 1 : 0,
					survived: player.survived ? 1 : 0,
					isWinner: player.isWinner ? 1 : 0,
					infectedAtTurn: player.infectedAtTurn,
					role: player.role,
				})
				.run();
		}

		for (const event of match.events) {
			tx.insert(events)
				.values({
					matchId: match.matchId,
					seq: event.seq,
					ts: event.ts,
					turn: event.turn,
					type: event.type,
					actor: event.actor,
					target: event.target,
					actorKey: event.actor ? resolver.resolve(event.actor) : null,
					targetKey: event.target ? resolver.resolve(event.target) : null,
					cardId: event.cardId,
					actorRole: event.actorRole,
					targetRole: event.targetRole,
					detail: JSON.stringify(event.detail ?? {}),
				})
				.run();
		}

		insertMarks(tx, match, resolver);
	});
};

const upsertPlayer = (
	tx: TDb,
	{key, player, match}: {key: string; player: IAnalyticsMatchPlayer; match: IAnalyticsMatch},
) => {
	tx.insert(players)
		.values({
			key,
			displayName: player.nickname,
			firstSeen: match.startedAt,
			lastSeen: match.endedAt,
			isBot: player.isBot ? 1 : 0,
			isHidden: 0,
		})
		.onConflictDoUpdate({
			target: players.key,
			set: {
				// Показываем последнее написание ника — люди меняют регистр.
				displayName: sql`excluded.display_name`,
				firstSeen: sql`min(${players.firstSeen}, excluded.first_seen)`,
				lastSeen: sql`max(${players.lastSeen}, excluded.last_seen)`,
				isBot: sql`excluded.is_bot`,
			},
		})
		.run();
};

/**
 * Простановки статусов раскладываем отдельно и сразу считаем производное:
 * правоту (по состоянию цели на тот момент), «итоговое мнение» и схлопывание
 * транзитных нажатий (см. markRows.ts).
 */
const insertMarks = (tx: TDb, match: IAnalyticsMatch, resolver: AliasResolver) => {
	const inputs: IMarkInput[] = [];
	for (const event of match.events) {
		if (event.type !== EAnalyticsEvent.mark || !event.actor || !event.target) continue;
		const mark = String(event.detail.mark ?? '');
		if (!mark) continue;
		inputs.push({
			seq: event.seq,
			ts: event.ts,
			turn: event.turn,
			actorKey: resolver.resolve(event.actor),
			targetKey: resolver.resolve(event.target),
			actor: event.actor,
			target: event.target,
			mark,
			previousMark: typeof event.detail.previousMark === 'string' ? event.detail.previousMark : null,
			targetWasThing: event.detail.targetWasThing === true,
			targetWasInfected: event.detail.targetWasInfected === true,
		});
	}
	const rows = buildMarkRows({matchId: match.matchId, inputs});
	for (const row of rows) tx.insert(marks).values(row).run();
};

// ------------------------------------------------------------------ разбор

/**
 * Ручная валидация вместо схемной библиотеки: полей немного, зато понятно, что
 * именно отвергнуто, и одна лишняя зависимость не тянется в рантайм.
 */
const parsePayload = (payload: unknown): {version: number; matches: unknown[]} => {
	if (!isRecord(payload)) throw new IngestError('Тело запроса должно быть объектом');
	const version = Number(payload.version);
	if (!Number.isFinite(version)) throw new IngestError('Не указана версия контракта');
	if (version > ANALYTICS_CONTRACT_VERSION) {
		throw new IngestError(`Версия контракта ${version} новее, чем понимает сервер (${ANALYTICS_CONTRACT_VERSION})`);
	}
	if (!Array.isArray(payload.matches)) throw new IngestError('Ожидался массив matches');
	if (payload.matches.length > 50) throw new IngestError('За раз принимаем не больше 50 партий');
	return {version, matches: payload.matches};
};

const parseMatch = (raw: unknown): IAnalyticsMatch => {
	if (!isRecord(raw)) throw new IngestError('Партия должна быть объектом');
	const matchId = str(raw.matchId);
	if (!matchId) throw new IngestError('У партии нет matchId');
	const rawPlayers = Array.isArray(raw.players) ? raw.players : [];
	if (rawPlayers.length === 0) throw new IngestError('В партии нет игроков');
	const rawEvents = Array.isArray(raw.events) ? raw.events : [];
	const startedAt = num(raw.startedAt) ?? Date.now();
	const endedAt = num(raw.endedAt) ?? startedAt;

	return {
		matchId,
		seed: num(raw.seed) ?? 0,
		source: (str(raw.source) || 'live') as IAnalyticsMatch['source'],
		startedAt,
		endedAt,
		durationMs: num(raw.durationMs) ?? Math.max(0, endedAt - startedAt),
		playerCount: num(raw.playerCount) ?? rawPlayers.length,
		turns: num(raw.turns) ?? 0,
		winner: (str(raw.winner) || null) as IAnalyticsMatch['winner'],
		endReason: (str(raw.endReason) || 'other') as IAnalyticsMatch['endReason'],
		endMessage: str(raw.endMessage) ?? '',
		isComplete: raw.isComplete === true,
		hasBots: raw.hasBots === true,
		players: rawPlayers.map(parsePlayer),
		events: rawEvents.map(parseEvent).filter((e): e is IAnalyticsEvent => e !== null),
		gameLog: Array.isArray(raw.gameLog)
			? raw.gameLog.filter(isRecord).map((line) => ({text: str(line.text) ?? '', type: str(line.type) ?? 'info'}))
			: [],
	};
};

const parsePlayer = (raw: unknown): IAnalyticsMatchPlayer => {
	if (!isRecord(raw)) throw new IngestError('Игрок должен быть объектом');
	const nickname = str(raw.nickname);
	if (!nickname) throw new IngestError('У игрока нет ника');
	return {
		nickname,
		seat: num(raw.seat) ?? 0,
		isBot: raw.isBot === true,
		isThing: raw.isThing === true,
		infectedAtEnd: raw.infectedAtEnd === true,
		survived: raw.survived === true,
		isWinner: raw.isWinner === true,
		infectedAtTurn: num(raw.infectedAtTurn),
		role: (str(raw.role) || 'human') as IAnalyticsMatchPlayer['role'],
	};
};

const parseEvent = (raw: unknown): IAnalyticsEvent | null => {
	if (!isRecord(raw)) return null;
	const type = str(raw.type);
	const seq = num(raw.seq);
	if (!type || seq === null) return null;
	return {
		seq,
		ts: num(raw.ts) ?? 0,
		turn: num(raw.turn) ?? 0,
		type: type as IAnalyticsEvent['type'],
		actor: str(raw.actor),
		target: str(raw.target),
		cardId: str(raw.cardId),
		actorRole: (str(raw.actorRole) || null) as IAnalyticsEvent['actorRole'],
		targetRole: (str(raw.targetRole) || null) as IAnalyticsEvent['targetRole'],
		detail: isRecord(raw.detail) ? (raw.detail as IAnalyticsEvent['detail']) : {},
	};
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
