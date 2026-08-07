import {eq} from 'drizzle-orm';
import {aliases} from 'analytics/db/schema';
import type {TDb} from 'analytics/db/client';

/**
 * Каноничный ключ ника. Ровно та же нормализация, что и в игровом сервере
 * (`sameNickname` в GameServer): человек — это его ник без учёта регистра и
 * краевых пробелов, иначе «Вася» и «вася » окажутся разными людьми.
 */
export const nicknameKey = (nickname: string): string => nickname.trim().toLowerCase();

/**
 * Разрешение слитых ников. Админка, объединяя двух «людей», пишет alias -> канон;
 * все новые партии с алиасом сразу ложатся под каноничный ключ.
 *
 * Цепочки (a -> b -> c) разворачиваются с ограничением по глубине: кольцо в
 * таблице алиасов не должно вешать ingest.
 */
export class AliasResolver {
	private map: Map<string, string>;

	constructor(rows: {aliasKey: string; canonicalKey: string}[]) {
		this.map = new Map(rows.map((row) => [row.aliasKey, row.canonicalKey]));
	}

	static load(db: TDb): AliasResolver {
		return new AliasResolver(db.select().from(aliases).all());
	}

	static empty(): AliasResolver {
		return new AliasResolver([]);
	}

	resolve(nickname: string): string {
		let key = nicknameKey(nickname);
		for (let depth = 0; depth < 8; depth++) {
			const next = this.map.get(key);
			if (!next || next === key) return key;
			key = next;
		}
		return key;
	}
}

/** Удалить алиас (админка «разлепила» ники обратно). */
export const dropAlias = (db: TDb, aliasKey: string) => {
	db.delete(aliases).where(eq(aliases.aliasKey, aliasKey)).run();
};
