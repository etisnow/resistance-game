import { createServer, IncomingMessage, ServerResponse } from "http";
import { join, normalize, extname } from "path";
import { Server as SocketIOServer, Socket } from "socket.io";
import { registerHandlers } from "server/handlers/handlers";
import { gameServer } from "server/server/GameServer";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

// Built client bundle (see scripts/buildClient.ts). Served statically by Bun.
const CLIENT_DIR = join(import.meta.dir, "../../dist/client");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

// Resolve a request URL to a file inside CLIENT_DIR, guarding against traversal.
function resolveStaticPath(urlPath: string): string | null {
  const clean = decodeURIComponent(urlPath.split("?")[0] ?? "");
  const rel = normalize(clean).replace(/^(\.\.[/\\])+/, "");
  const abs = join(CLIENT_DIR, rel);
  if (!abs.startsWith(CLIENT_DIR)) return null;
  return abs;
}

// Static file server (Bun.file). socket.io is attached on top of this http
// server and transparently intercepts its own /socket.io/* requests, delegating
// everything else here. Express is intentionally not used.
async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const urlPath = req.url || "/";

  if (urlPath === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  const candidate = resolveStaticPath(urlPath === "/" ? "/index.html" : urlPath);
  if (candidate) {
    const file = Bun.file(candidate);
    if (await file.exists()) {
      const type = MIME[extname(candidate)] || file.type || "application/octet-stream";
      res.writeHead(200, { "content-type": type });
      res.end(Buffer.from(await file.arrayBuffer()));
      return;
    }
  }

  // SPA fallback: serve index.html for unknown non-asset routes.
  const index = Bun.file(join(CLIENT_DIR, "index.html"));
  if (await index.exists()) {
    res.writeHead(200, { "content-type": MIME[".html"] });
    res.end(Buffer.from(await index.arrayBuffer()));
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end(
    "Client bundle not found. Build it first: `./run build` (or `bun run build:client`).",
  );
}

const httpServer = createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error("Request error:", err);
    if (!res.headersSent) res.writeHead(500);
    res.end("Internal server error");
  });
});

const io = new SocketIOServer(httpServer, {
  // Same-origin in production; permissive in dev so local tooling and Playwright
  // can connect from any local origin.
  cors: { origin: true, credentials: true },
});

gameServer.initialize(io);

io.on("connection", (socket: Socket) => {
  try {
    gameServer.initSocket(socket);
    registerHandlers(gameServer, socket);
  } catch (err) {
    console.error("Connection setup error:", err);
  }
});

// Last-resort safety net: never let an unexpected error or rejection take the
// whole server process down — log it and keep serving other players.
process.on("uncaughtException", (err) => {
  console.error("uncaughtException (server kept alive):", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection (server kept alive):", reason);
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Nechto server listening on http://${HOST}:${PORT}`);
  console.log(`Serving client from ${CLIENT_DIR}`);
});

export { httpServer, io };
