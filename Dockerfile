# Production image for both services (server runs the bun socket.io backend;
# client runs `vite preview` over the same image). Bun is the runtime; vite the
# client bundler.
FROM oven/bun:1.3.14-slim AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
COPY analytics/package.json ./analytics/package.json
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
# Client bundle (vite) -> dist/client, server bundle (bun) -> dist/server,
# витрина аналитики (vite) -> analytics/dist/web.
RUN bunx vite build \
 && bun run scripts/buildServer.ts \
 && cd analytics && bunx vite build

FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/vite.config.ts ./vite.config.ts
COPY --from=build /app/index.html ./index.html
COPY --from=build /app/public ./public
COPY --from=build /app/bunfig.toml ./bunfig.toml
# Аналитический центр целиком: сервер бежит прямо по TS-исходникам под bun,
# витрина уже собрана, миграции нужны на старте.
COPY --from=build /app/analytics/src ./analytics/src
COPY --from=build /app/analytics/drizzle ./analytics/drizzle
COPY --from=build /app/analytics/dist ./analytics/dist
COPY --from=build /app/analytics/package.json ./analytics/package.json
COPY --from=build /app/analytics/tsconfig.json ./analytics/tsconfig.json
COPY --from=build /app/src/shared ./src/shared
EXPOSE 3000 3200 5173
# Default: the backend. The client service overrides this with `vite preview`.
CMD ["bun", "dist/server/index.js"]
