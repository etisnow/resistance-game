// Крошечный роутер: методов немного, зависимостей ноль. Совпадение по методу и
// шаблону пути вида `/api/players/:key`.

export type THandler = (ctx: IRequestContext) => Response | Promise<Response>;

export interface IRequestContext {
	req: Request;
	url: URL;
	params: Record<string, string>;
}

interface IRoute {
	method: string;
	segments: string[];
	handler: THandler;
}

export class Router {
	private routes: IRoute[] = [];

	add(method: string, pattern: string, handler: THandler) {
		this.routes.push({method, segments: pattern.split('/').filter(Boolean), handler});
		return this;
	}

	get(pattern: string, handler: THandler) {
		return this.add('GET', pattern, handler);
	}

	post(pattern: string, handler: THandler) {
		return this.add('POST', pattern, handler);
	}

	delete(pattern: string, handler: THandler) {
		return this.add('DELETE', pattern, handler);
	}

	match(req: Request, url: URL): {handler: THandler; params: Record<string, string>} | null {
		const parts = url.pathname.split('/').filter(Boolean);
		for (const route of this.routes) {
			if (route.method !== req.method) continue;
			if (route.segments.length !== parts.length) continue;
			const params: Record<string, string> = {};
			let ok = true;
			for (let i = 0; i < route.segments.length; i++) {
				const segment = route.segments[i] ?? '';
				const value = parts[i] ?? '';
				if (segment.startsWith(':')) {
					params[segment.slice(1)] = decodeURIComponent(value);
					continue;
				}
				if (segment !== value) {
					ok = false;
					break;
				}
			}
			if (ok) return {handler: route.handler, params};
		}
		return null;
	}
}

// Публичная витрина живёт на отдельном домене, а данные отдаёт этот сервер —
// поэтому CORS открыт на чтение. Ingest защищён токеном, а не origin'ом.
export const CORS_HEADERS: Record<string, string> = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': 'content-type, authorization',
	'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
};

export const json = (data: unknown, status = 200): Response =>
	new Response(JSON.stringify(data), {
		status,
		headers: {'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS},
	});

export const error = (message: string, status = 400): Response => json({error: message}, status);

export const readJson = async (req: Request): Promise<unknown> => {
	try {
		return await req.json();
	} catch {
		throw new Error('Тело запроса — не JSON');
	}
};

/** Bearer-токен из заголовка (или ?token= — удобно для ручной проверки). */
export const bearer = (req: Request, url: URL): string => {
	const header = req.headers.get('authorization') || '';
	if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
	return url.searchParams.get('token') || '';
};

/**
 * Сравнение секретов за постоянное время — токены короткие, а сервис публичный.
 */
export const secretEquals = (a: string, b: string): boolean => {
	if (!a || !b || a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
};
