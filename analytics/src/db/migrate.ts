import {getDb, getSqlite} from 'analytics/db/client';

// Миграции накатываются и на старте сервера, но отдельная команда нужна для
// деплоя и для проверки, что база вообще открывается: `bun run db:migrate`.
getDb();
const path = getSqlite().filename;
console.log(`[analytics] база готова: ${path}`);
