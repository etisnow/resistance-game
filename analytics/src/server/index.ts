import {join, normalize} from 'path';
import {ANALYTICS_CONTRACT_VERSION} from 'shared/analytics/contract';
import {getDb, getSqlite} from 'analytics/db/client';
import {IngestError, ingestMatches} from 'analytics/db/ingest';
import {nicknameKey} from 'analytics/db/nicknames';
import {Router, bearer, error, json, readJson, secretEquals, CORS_HEADERS} from 'analytics/server/http';
import {parseFilters} from 'analytics/server/queries/filters';
import {getOverview} from 'analytics/server/queries/overview';
import {getPlayerDetail, getPlayers} from 'analytics/server/queries/players';
import {getAwards, getPlayerAwards} from 'analytics/server/queries/awards';
import {getMatchDetail, getMatches, getSourceCounts, deleteMatch, setMatchHidden} from 'analytics/server/queries/matches';
import {getMatrix} from 'analytics/server/queries/matrix';
import {getFlamethrowerStats} from 'analytics/server/queries/flamethrower';
import {
	anonymizeFlamethrower,
	anonymizeMatchDetail,
	anonymizeMatchRows,
	anonymizeMatrix,
	anonymizePlayerDetail,
	anonymizePlayers,
	buildAnonymizer,
} from 'analytics/server/privacy';
import {
	exportAll,
	getAdminStats,
	getSetting,
	mergePlayers,
	recomputeMarks,
	renamePlayer,
	setPlayerHidden,
	setSetting,
} from 'analytics/server/admin';

const PORT = Number(process.env.ANALYTICS_PORT) || 3200;
const HOST = process.env.ANALYTICS_HOST || '0.0.0.0';
// Токен игрового сервера. Пустой — приём партий запрещён совсем: открытый
// ingest на публичном домене означал бы, что статистику может залить кто угодно.
const INGEST_TOKEN = () => process.env.ANALYTICS_TOKEN || '';
// Пароль админки. Пустой — админка недоступна (только публичная витрина).
const ADMIN_TOKEN = () => process.env.ANALYTICS_ADMIN_TOKEN || '';
// Собранный фронт. Отдаём его сами, чтобы на проде хватило одного контейнера.
const WEB_DIR = process.env.ANALYTICS_WEB_DIR || join(import.meta.dir, '../../dist/web');

const db = getDb();
const router = new Router();

// Показывать ли ники на публичной витрине. Переключается в админке; обзор
// обезличен в любом случае (см. server/privacy.ts).
const anonymizer = () => buildAnonymizer(db, getSetting(db, 'showNicknames', 'true') !== 'true');

// ------------------------------------------------------------------ приём

router.post('/api/ingest', async ({req}) => {
	const token = INGEST_TOKEN();
	if (!token) return error('Приём партий выключен: не задан ANALYTICS_TOKEN', 503);
	if (!secretEquals(bearer(req, new URL(req.url)), token)) return error('Неверный токен', 401);
	try {
		const result = ingestMatches(db, await readJson(req));
		return json(result);
	} catch (e) {
		if (e instanceof IngestError) return error(e.message, 422);
		console.error('[analytics] ingest упал:', e);
		return error('Не удалось принять партию', 500);
	}
});

// --------------------------------------------------------- публичные ручки

router.get('/api/meta', ({url}) => {
	const sources = getSourceCounts(db).map((row) => ({key: row.key, count: Number(row.count)}));
	const filters = parseFilters(url);
	const overview = getOverview(db, filters);
	return json({
		title: getSetting(db, 'title', 'Нечто: исследовательский центр'),
		showNicknames: getSetting(db, 'showNicknames', 'true') === 'true',
		sources,
		totals: {
			matches: overview.totals.matches,
			players: overview.totals.players,
			events: overview.totals.events,
		},
		lastMatchAt: overview.totals.lastMatchAt,
		contractVersion: ANALYTICS_CONTRACT_VERSION,
	});
});

router.get('/api/overview', ({url}) => json(getOverview(db, parseFilters(url))));

router.get('/api/players', ({url}) => json(anonymizePlayers(getPlayers(db, parseFilters(url)), anonymizer())));

router.get('/api/players/:key', ({url, params}) => {
	const filters = parseFilters(url);
	const key = nicknameKey(params.key ?? '');
	const detail = getPlayerDetail(db, key, filters);
	if (!detail) return error('Игрок не найден', 404);
	detail.awards = getPlayerAwards(getPlayers(db, filters), key);
	return json(anonymizePlayerDetail(detail, anonymizer()));
});

router.get('/api/awards', ({url}) => {
	const anon = anonymizer();
	const awards = getAwards(anonymizePlayers(getPlayers(db, parseFilters(url)), anon));
	return json(awards);
});

router.get('/api/matrix', ({url}) => json(anonymizeMatrix(getMatrix(db, parseFilters(url)), anonymizer())));

router.get('/api/flamethrower', ({url}) =>
	json(anonymizeFlamethrower(getFlamethrowerStats(db, parseFilters(url)), anonymizer())),
);

router.get('/api/matches', ({url}) => {
	const limit = Number(url.searchParams.get('limit')) || 50;
	const offset = Number(url.searchParams.get('offset')) || 0;
	const page = getMatches(db, parseFilters(url), {limit, offset});
	return json({...page, rows: anonymizeMatchRows(page.rows, anonymizer())});
});

router.get('/api/matches/:id', ({params}) => {
	const detail = getMatchDetail(db, params.id ?? '');
	if (!detail || detail.match.isHidden) return error('Партия не найдена', 404);
	return json(anonymizeMatchDetail(detail, anonymizer()));
});

// ------------------------------------------------------------------ админка

const requireAdmin = (req: Request, url: URL): Response | null => {
	const token = ADMIN_TOKEN();
	if (!token) return error('Админка выключена: не задан ANALYTICS_ADMIN_TOKEN', 503);
	if (!secretEquals(bearer(req, url), token)) return error('Неверный пароль', 401);
	return null;
};

const admin = (handler: (ctx: {req: Request; url: URL; params: Record<string, string>}) => Response | Promise<Response>) =>
	async (ctx: {req: Request; url: URL; params: Record<string, string>}) => {
		const denied = requireAdmin(ctx.req, ctx.url);
		if (denied) return denied;
		try {
			return await handler(ctx);
		} catch (e) {
			return error(e instanceof Error ? e.message : 'Ошибка', 400);
		}
	};

router.post('/api/admin/login', admin(() => json({ok: true})));

router.get('/api/admin/stats', admin(() => json(getAdminStats(db, getSqlite().filename))));

router.get(
	'/api/admin/matches',
	admin(({url}) => {
		const limit = Number(url.searchParams.get('limit')) || 100;
		const offset = Number(url.searchParams.get('offset')) || 0;
		return json(getMatches(db, parseFilters(url), {limit, offset, includeHidden: true}));
	}),
);

router.post(
	'/api/admin/matches/:id/hidden',
	admin(async ({req, params}) => {
		const body = (await readJson(req)) as {hidden?: unknown};
		setMatchHidden(db, params.id ?? '', body.hidden === true);
		return json({ok: true});
	}),
);

router.delete(
	'/api/admin/matches/:id',
	admin(({params}) => {
		deleteMatch(db, params.id ?? '');
		return json({ok: true});
	}),
);

router.get(
	'/api/admin/players',
	admin(({url}) => json(getPlayers(db, {...parseFilters(url), minMatches: 0}))),
);

router.post(
	'/api/admin/players/merge',
	admin(async ({req}) => {
		const body = (await readJson(req)) as {from?: unknown; into?: unknown};
		mergePlayers(db, String(body.from ?? ''), String(body.into ?? ''));
		recomputeMarks(db);
		return json({ok: true});
	}),
);

router.post(
	'/api/admin/players/:key/rename',
	admin(async ({req, params}) => {
		const body = (await readJson(req)) as {displayName?: unknown};
		renamePlayer(db, nicknameKey(params.key ?? ''), String(body.displayName ?? ''));
		return json({ok: true});
	}),
);

router.post(
	'/api/admin/players/:key/hidden',
	admin(async ({req, params}) => {
		const body = (await readJson(req)) as {hidden?: unknown};
		setPlayerHidden(db, nicknameKey(params.key ?? ''), body.hidden === true);
		return json({ok: true});
	}),
);

router.post('/api/admin/recompute', admin(() => json(recomputeMarks(db))));

router.post(
	'/api/admin/settings',
	admin(async ({req}) => {
		const body = (await readJson(req)) as Record<string, unknown>;
		for (const [key, value] of Object.entries(body)) setSetting(db, key, String(value));
		return json({ok: true});
	}),
);

router.get('/api/admin/export', admin(() => json(exportAll(db))));

/**
 * Ручной импорт спула: если аналитика лежала, игровой сервер складывал партии в
 * JSONL-файл — сюда его содержимое и приезжает.
 */
router.post(
	'/api/admin/import',
	admin(async ({req}) => {
		const text = await req.text();
		const parsedMatches = text
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => JSON.parse(line) as unknown);
		return json(ingestMatches(db, {version: ANALYTICS_CONTRACT_VERSION, matches: parsedMatches}));
	}),
);

// ------------------------------------------------------------------ статика

const MIME: Record<string, string> = {
	html: 'text/html; charset=utf-8',
	js: 'text/javascript; charset=utf-8',
	css: 'text/css; charset=utf-8',
	json: 'application/json; charset=utf-8',
	svg: 'image/svg+xml',
	png: 'image/png',
	ico: 'image/x-icon',
	woff2: 'font/woff2',
};

const serveStatic = async (pathname: string): Promise<Response | null> => {
	const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
	const candidate = join(WEB_DIR, clean === '/' ? 'index.html' : clean);
	if (!candidate.startsWith(WEB_DIR)) return null;
	const file = Bun.file(candidate);
	if (await file.exists()) {
		const ext = candidate.split('.').pop() ?? '';
		return new Response(file, {headers: {'content-type': MIME[ext] ?? file.type ?? 'application/octet-stream'}});
	}
	// SPA: все неизвестные пути — это маршруты фронта.
	const index = Bun.file(join(WEB_DIR, 'index.html'));
	if (await index.exists()) return new Response(index, {headers: {'content-type': MIME.html ?? 'text/html'}});
	return null;
};

const server = Bun.serve({
	port: PORT,
	hostname: HOST,
	async fetch(req) {
		const url = new URL(req.url);
		if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: CORS_HEADERS});
		if (url.pathname === '/healthz') return new Response('ok');

		const route = router.match(req, url);
		if (route) {
			try {
				return await route.handler({req, url, params: route.params});
			} catch (e) {
				console.error('[analytics] ошибка обработчика:', e);
				return error('Внутренняя ошибка', 500);
			}
		}
		if (url.pathname.startsWith('/api/')) return error('Не найдено', 404);

		const asset = await serveStatic(url.pathname);
		if (asset) return asset;
		return new Response(
			'Фронт не собран. Собери его: `./run analytics build` (или bun run --cwd analytics build:web).',
			{status: 404, headers: {'content-type': 'text/plain; charset=utf-8'}},
		);
	},
});

// Аналитика не имеет права падать: она не критична для игры, но её падение
// уронило бы публичный сайт.
process.on('uncaughtException', (e) => console.error('[analytics] uncaughtException:', e));
process.on('unhandledRejection', (e) => console.error('[analytics] unhandledRejection:', e));

console.log(`[analytics] слушаю http://${HOST}:${server.port}`);
console.log(`[analytics] база: ${getSqlite().filename}`);
console.log(`[analytics] приём партий: ${INGEST_TOKEN() ? 'включён' : 'ВЫКЛЮЧЕН (нет ANALYTICS_TOKEN)'}`);
console.log(`[analytics] админка: ${ADMIN_TOKEN() ? 'включена' : 'ВЫКЛЮЧЕНА (нет ANALYTICS_ADMIN_TOKEN)'}`);

export {server};
