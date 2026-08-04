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

Installs deps if missing, brings the stack up in the background, then waits until
localhost **and** the public tunnel host both answer, and prints the URLs:

- **http://localhost:5173** — vite dev server (HMR), proxies `/socket.io` to the
  backend container on `:3000`
- **https://nechto.estaco.my** — the same client through the tunnel
- **https://api-nechto.estaco.my** — API server (bun socket.io); the client
  connects to it cross-origin (`VITE_SERVER_URL`)

`./run up` does the same in the foreground with logs streaming; `./run down`
stops everything.

### Cloudflare tunnel

The tunnel is **created by hand** in the Cloudflare dashboard — ingress and DNS
live there. Point it at the compose services:

| Hostname         | Service              |
| ---------------- | -------------------- |
| `${CLIENT_HOST}` | `http://client:5173` |
| `${API_HOST}`    | `http://server:3000` |

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
| `./run go`         | One button: deps + the dev stack, waits for readiness              |
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

## Docker layout

- `docker-compose.yml` — dev: `client` (vite dev) + `server` (bun) + `tunnel`
  (cloudflared connector), source bind-mounted, host `node_modules` reused.
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
