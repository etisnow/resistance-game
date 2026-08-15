import type {
	IAdminStats,
	IAward,
	IMatchDetail,
	IMatchRow,
	IFlamethrowerStats,
	IMatrix,
	IMeta,
	IOverview,
	IPlayerDetail,
	IPlayerSummary,
} from 'analytics/shared/api';

// Клиент API. В деве vite проксирует /api на бекенд аналитики, в проде фронт и
// API отдаёт один и тот же сервер — поэтому база пустая (тот же origin).
const BASE = import.meta.env.VITE_ANALYTICS_API ?? '';

/** Общие фильтры витрины живут в URL и подмешиваются в каждый запрос. */
export interface IQuery {
	source?: string;
	bots?: boolean;
	incomplete?: boolean;
	minMatches?: number;
}

let currentQuery: IQuery = {};

export const setQuery = (query: IQuery) => {
	currentQuery = query;
};

export const getQuery = (): IQuery => currentQuery;

const queryString = (extra: Record<string, string | number | undefined> = {}): string => {
	const params = new URLSearchParams();
	if (currentQuery.source) params.set('source', currentQuery.source);
	if (currentQuery.bots) params.set('bots', 'true');
	if (currentQuery.incomplete) params.set('incomplete', 'true');
	if (currentQuery.minMatches !== undefined) params.set('minMatches', String(currentQuery.minMatches));
	for (const [key, value] of Object.entries(extra)) if (value !== undefined) params.set(key, String(value));
	const text = params.toString();
	return text ? `?${text}` : '';
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
	const response = await fetch(`${BASE}${path}`, init);
	if (!response.ok) {
		const body = (await response.json().catch(() => ({}))) as {error?: string};
		throw new Error(body.error || `Ошибка ${response.status}`);
	}
	return (await response.json()) as T;
};

export const api = {
	meta: () => request<IMeta>(`/api/meta${queryString()}`),
	overview: () => request<IOverview>(`/api/overview${queryString()}`),
	players: () => request<IPlayerSummary[]>(`/api/players${queryString()}`),
	player: (key: string) => request<IPlayerDetail>(`/api/players/${encodeURIComponent(key)}${queryString()}`),
	awards: () => request<IAward[]>(`/api/awards${queryString()}`),
	matrix: () => request<IMatrix>(`/api/matrix${queryString()}`),
	flamethrower: () => request<IFlamethrowerStats>(`/api/flamethrower${queryString()}`),
	matches: (limit = 50, offset = 0) =>
		request<{rows: IMatchRow[]; total: number}>(`/api/matches${queryString({limit, offset})}`),
	match: (id: string) => request<IMatchDetail>(`/api/matches/${encodeURIComponent(id)}`),
};

// ------------------------------------------------------------------ админка

const TOKEN_KEY = 'resistance-analytics-admin-token';

export const adminToken = {
	get: () => localStorage.getItem(TOKEN_KEY) ?? '',
	set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
	clear: () => localStorage.removeItem(TOKEN_KEY),
};

const adminRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> =>
	request<T>(path, {
		...init,
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${adminToken.get()}`,
			...(init.headers ?? {}),
		},
	});

export const adminApi = {
	login: (token: string) => {
		adminToken.set(token);
		return adminRequest<{ok: boolean}>('/api/admin/login', {method: 'POST', body: '{}'});
	},
	stats: () => adminRequest<IAdminStats>('/api/admin/stats'),
	matches: (limit = 100, offset = 0) =>
		adminRequest<{rows: IMatchRow[]; total: number}>(`/api/admin/matches?source=all&bots=true&incomplete=true&limit=${limit}&offset=${offset}`),
	players: () => adminRequest<IPlayerSummary[]>('/api/admin/players?source=all&bots=true&incomplete=true'),
	setMatchHidden: (id: string, hidden: boolean) =>
		adminRequest<{ok: boolean}>(`/api/admin/matches/${encodeURIComponent(id)}/hidden`, {
			method: 'POST',
			body: JSON.stringify({hidden}),
		}),
	deleteMatch: (id: string) =>
		adminRequest<{ok: boolean}>(`/api/admin/matches/${encodeURIComponent(id)}`, {method: 'DELETE'}),
	mergePlayers: (from: string, into: string) =>
		adminRequest<{ok: boolean}>('/api/admin/players/merge', {method: 'POST', body: JSON.stringify({from, into})}),
	renamePlayer: (key: string, displayName: string) =>
		adminRequest<{ok: boolean}>(`/api/admin/players/${encodeURIComponent(key)}/rename`, {
			method: 'POST',
			body: JSON.stringify({displayName}),
		}),
	setPlayerHidden: (key: string, hidden: boolean) =>
		adminRequest<{ok: boolean}>(`/api/admin/players/${encodeURIComponent(key)}/hidden`, {
			method: 'POST',
			body: JSON.stringify({hidden}),
		}),
	recompute: () => adminRequest<{matches: number; marks: number}>('/api/admin/recompute', {method: 'POST'}),
	setSettings: (settings: Record<string, string>) =>
		adminRequest<{ok: boolean}>('/api/admin/settings', {method: 'POST', body: JSON.stringify(settings)}),
	exportUrl: () => `${BASE}/api/admin/export?token=${encodeURIComponent(adminToken.get())}`,
	importSpool: (body: string) =>
		adminRequest<{accepted: number; duplicates: number; rejected: number}>('/api/admin/import', {
			method: 'POST',
			body,
			headers: {'content-type': 'text/plain'},
		}),
};
