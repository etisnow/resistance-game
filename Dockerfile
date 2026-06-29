# Production image for both services (server runs the bun socket.io backend;
# client runs `vite preview` over the same image). Bun is the runtime; vite the
# client bundler.
FROM oven/bun:1.3.14-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
# Client bundle (vite) -> dist/client, server bundle (bun) -> dist/server.
RUN bunx vite build && bun run scripts/buildServer.ts

FROM oven/bun:1.3.14-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/vite.config.ts ./vite.config.ts
COPY --from=build /app/index.html ./index.html
COPY --from=build /app/public ./public
EXPOSE 3000 5173
# Default: the backend. The client service overrides this with `vite preview`.
CMD ["bun", "dist/server/index.js"]
