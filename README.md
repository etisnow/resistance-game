# Нечто (The Thing) — multiplayer card game

A real-time multiplayer card game: **React 16 + PixiJS** client (bundled by
**vite**) and a **socket.io** game engine on **[Bun](https://bun.sh)**. Both the
client (vite) and the backend (bun) run as **Docker** services — like grailgun.
Bun is the package manager / runtime; Express, yarn and CRA are gone.

## Quick start — one button

```bash
./run go           # everything, publicly: deps + CF tunnel + client + server
```

Installs deps if missing, provisions the Cloudflare tunnel + DNS, starts
`client` / `server` / `cloudflared`, then waits until each actually answers and
prints the public URLs. Alias of `./run tunnel up`.

## Quick start (Docker, localhost only)

```bash
./run install      # bun install + Playwright chromium (once, on the host)
./run up           # start the dev stack: vite client + bun server, in Docker
```

Open **http://localhost:5173** — the vite dev server (HMR) proxies `/socket.io`
to the backend container on `:3000`.

### Prod stack

```bash
./run prod up      # build the image (vite build + bun bundle) and run both services
```

`vite preview` serves the built client on `:5173` and proxies `/socket.io` to the
bun backend on `:3000`.

### Public Cloudflare tunnel

Exposes the stack on real subdomains (like grailgun's `./wt`):

```bash
./run tunnel up    # provision CF tunnel + DNS, then run the stack + cloudflared
./run tunnel down  # stop the stack and delete the tunnel + DNS
./run tunnel status
```

- `https://nechto.estaco.my` → client (vite)
- `https://api-nechto.estaco.my` → API server (bun socket.io); the client connects
  to it cross-origin (`VITE_SERVER_URL`).

`cmd/tunnel` provisions a named Cloudflare tunnel (ingress + DNS CNAMEs) via the
Cloudflare API; a `cloudflared` container then runs it. Credentials and host names
live in `.env` (git-ignored): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`CLOUDFLARE_ZONE_ID`, `ROOT_HOST`, `CLIENT_HOST`, `API_HOST`.

## `./run` commands

| Command            | What it does                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `./run go`         | One button: deps + tunnel + client + server, waits for readiness   |
| `./run up`         | Dev stack in Docker (vite client + bun server, hot reload)         |
| `./run down`       | Stop the dev stack                                                 |
| `./run logs [svc]` | Follow logs (`client` or `server`)                                 |
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

## Docker layout

- `docker-compose.yml` — dev: `client` (vite dev) + `server` (bun), source
  bind-mounted, host `node_modules` reused.
- `docker-compose.prod.yml` + `Dockerfile` — prod: one image (vite build + bun
  bundle); `server` runs the backend, `client` runs `vite preview`.

## Source layout

- `src/client` — React + PixiJS client (vite). SCSS via vite's sass; assets via
  vite. Talks to the server over socket.io (same-origin in prod, proxied in dev).
- `src/server` — the bun server (`index.ts`): `node:http` + socket.io v4, serves
  `dist/client`; no Express. Bundled by `scripts/buildServer.ts`.
- `src/shared` — enums / interfaces / card definitions shared by both sides.
- `src/_integration` — engine unit tests (`*Test.ts`).
- `e2e` — Playwright tests (launcher + a full multiplayer game start).

## Tests

- **Unit:** `./run test` — engine logic against scripted board states.
- **E2E:** `./run e2e` — real Chromium: a host plus four joiners assemble in a
  lobby, ready up, and start a real game; verifies the PixiJS table renders.
