# Нечто (The Thing) — multiplayer card game

A real-time multiplayer card game: **React 16 + PixiJS** client (bundled by
**vite**) and a **socket.io** game engine on **[Bun](https://bun.sh)**. Both the
client (vite) and the backend (bun) run as **Docker** services — like grailgun.
Bun is the package manager / runtime; Express, yarn and CRA are gone.

## Quick start — one button

```bash
./run install      # bun install + Playwright chromium (once, on the host)
./run go           # the whole dev stack: client + server + tunnel
```

Installs deps if missing, brings up **и игру, и аналитический центр** в фоне,
ждёт, пока ответят localhost **и** публичные хосты туннеля, и печатает URL:

- **http://localhost:5173** — vite dev server (HMR), proxies `/socket.io` to the
  backend container on `:3000`
- **https://nechto.estaco.my** — the same client through the tunnel
- **https://api-nechto.estaco.my** — API server (bun socket.io); the client
  connects to it cross-origin (`VITE_SERVER_URL`)
- **http://localhost:5174** / **https://analytics-nechto.estaco.my** — витрина
  статистики
- **http://localhost:3200** / **https://analytics-server-nechto.estaco.my** — её API

`./run up` does the same in the foreground with logs streaming; `./run down`
stops everything.

### Cloudflare tunnel

The tunnel is **created by hand** in the Cloudflare dashboard — ingress and DNS
live there. Point it at the compose services:

| Hostname                    | Service                        |
| --------------------------- | ------------------------------ |
| `${CLIENT_HOST}`            | `http://client:5173`           |
| `${API_HOST}`               | `http://server:3000`           |
| `${ANALYTICS_HOST_PUBLIC}`  | `http://analytics-web:5174`    |
| `${ANALYTICS_API_HOST}`     | `http://analytics-server:3200` |

Витрина статистики ходит в своё API относительным путём `/api` (vite проксирует
его на `analytics-server`), поэтому для работы сайта хватает одного хоста —
второй нужен, чтобы дёргать API напрямую.

Then put three values in `.env` (git-ignored): `CLOUDFLARE_TUNNEL_TOKEN` (the
connector token from *Tunnels → Install connector*), `CLIENT_HOST` and `API_HOST`.
The `tunnel` service in `docker-compose.yml` runs the connector with that token;
`./run logs tunnel` follows it.

### Prod stack

```bash
./run prod up      # build the image (vite build + bun bundle) and run both services
```

`vite preview` serves the built client on `:5173` and proxies `/socket.io` to the
bun backend on `:3000`. No tunnel here — prod is localhost-only.

## `./run` commands

| Command            | What it does                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `./run go`         | One button: deps + весь дев-стек (игра + аналитика), ждёт готовности |
| `./run up`         | Same stack in the foreground, logs streaming                       |
| `./run down`       | Stop the dev stack                                                 |
| `./run logs [svc]` | Follow logs (`client`, `server` or `tunnel`)                       |
| `./run prod up`    | Build + run the prod stack (`docker-compose.prod.yml`)             |
| `./run install`    | `bun install` + Playwright chromium                                |
| `./run server`     | Run the backend (bun) locally, hot reload                          |
| `./run client`     | Run the vite dev server locally (proxies socket.io to `:3000`)     |
| `./run build`      | Build client (vite → `dist/client`) + server (bun → `dist/server`) |
| `./run start`      | Run the bundled server locally                                     |
| `./run test`       | Unit test suite (`bun test`)                                       |
| `./run e2e`        | Build client, run Playwright browser e2e                           |
| `./run typecheck`  | `tsc --noEmit`                                                     |
| `./run clean`      | Remove `dist/` and build output                                    |
| `./run analytics …`| Аналитический центр: `up`, `server`, `web`, `build`, `migrate`, `seed`, `generate`, `typecheck`, `test` |

## Аналитический центр

`analytics/` — второй пакет монорепы: сбор и публикация статистики по партиям
(кто какие статусы ставил, на кого, кто был прав, у кого какие победы).
Собственный bun-сервер, витрина, админка и SQLite через drizzle. Подробности —
**[analytics/README.md](analytics/README.md)**.

```bash
./run analytics migrate && ./run analytics seed   # база + демо-данные
./run analytics server                            # API на :3200
./run analytics web                               # витрина на :5174
```

Игровой сервер отправляет туда **законченные** партии (во время игры наружу не
уходит ничего) — включается переменными `ANALYTICS_URL` и `ANALYTICS_TOKEN`, см.
`.env.example`. Без них игра работает ровно как раньше.

Витрина рассчитана на отдельный публичный домен: направьте на сервис
`analytics` ещё один хост туннеля (`${ANALYTICS_HOST_PUBLIC}`) — он отдаёт и
API, и собранный фронт.

## Docker layout

- `docker-compose.yml` — dev: `client` (vite dev) + `server` (bun) + `tunnel`
  (cloudflared connector), source bind-mounted, host `node_modules` reused.
  Сервисы `analytics-server` / `analytics-web` живут в профиле `analytics`:
  `./run go` поднимает их вместе с игрой, `./run up` — нет (только
  `./run analytics up`).
- `docker-compose.prod.yml` + `Dockerfile` — prod: one image (vite build + bun
  bundle); `server` runs the backend, `client` runs `vite preview`.

## Source layout

- `src/client` — React + PixiJS client (vite). SCSS via vite's sass; assets via
  vite. Talks to the server over socket.io (same-origin in prod, proxied in dev).
- `src/server` — the bun server (`index.ts`): `node:http` + socket.io v4, serves
  `dist/client`; no Express. Bundled by `scripts/buildServer.ts`.
- `src/shared` — enums / interfaces / card definitions shared by both sides;
  `src/shared/analytics/contract.ts` — контракт событий аналитики.
- `src/server/analytics` — запись партии и её отправка в аналитический центр.
- `analytics/` — сам аналитический центр (свой пакет, свой README).
- `src/_integration` — engine unit tests (`*Test.ts`).
- `e2e` — Playwright tests (launcher + a full multiplayer game start).

## Tests

- **Unit:** `./run test` — engine logic against scripted board states.
- **E2E:** `./run e2e` — real Chromium: a host plus four joiners assemble in a
  lobby, ready up, and start a real game; verifies the PixiJS table renders.
