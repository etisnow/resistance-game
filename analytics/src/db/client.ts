import {Database} from 'bun:sqlite';
import {drizzle, type BunSQLiteDatabase} from 'drizzle-orm/bun-sqlite';
import {migrate} from 'drizzle-orm/bun-sqlite/migrator';
import {mkdirSync} from 'fs';
import {dirname, join, resolve} from 'path';
import * as schema from 'analytics/db/schema';

// Где лежит база. По умолчанию — рядом с пакетом, чтобы `bun run server` из
// коробки работал без переменных окружения. В докере это том (см.
// docker-compose.yml), иначе статистика умрёт вместе с контейнером.
const DB_PATH = () => process.env.ANALYTICS_DB || join(import.meta.dir, '../../data/analytics.sqlite');
const MIGRATIONS_DIR = resolve(import.meta.dir, '../../drizzle');

export type TDb = BunSQLiteDatabase<typeof schema>;

let cached: {db: TDb; sqlite: Database} | null = null;

/**
 * Подключение к базе. Открывается один раз на процесс, миграции накатываются
 * на месте — отдельного шага деплоя не нужно.
 *
 * WAL включён осознанно: сервер читает много и параллельно (публичный сайт),
 * пишет редко и по одной партии.
 */
export const getDb = (): TDb => connect().db;

export const getSqlite = (): Database => connect().sqlite;

const connect = () => {
	if (cached) return cached;
	const path = DB_PATH();
	if (path !== ':memory:') mkdirSync(dirname(path), {recursive: true});
	const sqlite = new Database(path, {create: true});
	sqlite.exec('PRAGMA journal_mode = WAL;');
	sqlite.exec('PRAGMA foreign_keys = ON;');
	sqlite.exec('PRAGMA busy_timeout = 5000;');
	const db = drizzle(sqlite, {schema});
	migrate(db, {migrationsFolder: MIGRATIONS_DIR});
	cached = {db, sqlite};
	return cached;
};

/** Отдельная база (тесты, импорт). Мигрируется так же, но не кешируется. */
export const createDb = (path: string): {db: TDb; sqlite: Database} => {
	if (path !== ':memory:') mkdirSync(dirname(path), {recursive: true});
	const sqlite = new Database(path, {create: true});
	sqlite.exec('PRAGMA journal_mode = WAL;');
	const db = drizzle(sqlite, {schema});
	migrate(db, {migrationsFolder: MIGRATIONS_DIR});
	return {db, sqlite};
};

export {schema};
