import {defineConfig} from 'drizzle-kit';

// Миграции генерируются в analytics/drizzle и накатываются на старте сервера
// (см. src/db/client.ts). Путь к базе тот же, что у рантайма.
export default defineConfig({
	dialect: 'sqlite',
	schema: './src/db/schema.ts',
	out: './drizzle',
	dbCredentials: {
		url: process.env.ANALYTICS_DB || './data/analytics.sqlite',
	},
});
