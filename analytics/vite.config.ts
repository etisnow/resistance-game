import {defineConfig} from 'vite';
import {resolve} from 'path';

// Фронт аналитики: чистый TypeScript без фреймворка (страниц немного, а лишний
// рантайм на публичной витрине ни к чему).
//
// В деве vite проксирует /api на бекенд аналитики; в проде собранный бандл
// отдаёт тот же bun-сервер, что и API, — один контейнер на весь центр.

const API_TARGET = process.env.ANALYTICS_API_TARGET || 'http://localhost:3200';
const WEB_PORT = Number(process.env.ANALYTICS_WEB_PORT) || 5174;
// Публичный хост за Cloudflare-туннелем (например stats.estaco.my).
const PUBLIC_HOST = process.env.PUBLIC_ANALYTICS_HOST || '';

const allowedHosts = ['localhost', '127.0.0.1'];
if (PUBLIC_HOST) allowedHosts.push(PUBLIC_HOST);

export default defineConfig({
	root: __dirname,
	resolve: {
		alias: {
			analytics: resolve(__dirname, 'src'),
			// Общий код игры (контракт, названия карт) — тем же именем, что и внутри
			// игрового пакета.
			shared: resolve(__dirname, '../src/shared'),
		},
	},
	build: {
		outDir: 'dist/web',
		emptyOutDir: true,
	},
	server: {
		host: true,
		port: WEB_PORT,
		allowedHosts,
		proxy: {'/api': {target: API_TARGET, changeOrigin: true}},
		hmr: PUBLIC_HOST ? {host: PUBLIC_HOST, protocol: 'wss' as const, clientPort: 443} : undefined,
	},
	preview: {host: true, port: WEB_PORT, allowedHosts, proxy: {'/api': {target: API_TARGET, changeOrigin: true}}},
});
