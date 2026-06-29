import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Backend (bun socket.io) the dev/preview server proxies /socket.io to.
const PROXY_TARGET = process.env.VITE_PROXY_TARGET || "http://localhost:3000";
const CLIENT_PORT = Number(process.env.CLIENT_PORT) || 5173;

// Public host when served via the Cloudflare tunnel (e.g. nechto.estaco.my).
const ROOT_HOST = process.env.ROOT_HOST || "estaco.my";
const PUBLIC_CLIENT_HOST = process.env.PUBLIC_CLIENT_HOST || "";

const proxy = {
  "/socket.io": { target: PROXY_TARGET, ws: true, changeOrigin: true },
};

// Always allow localhost and any *.${ROOT_HOST} subdomain through vite's host
// check (so the tunnel host is never blocked, even without per-host env).
const allowedHosts = ["localhost", "127.0.0.1", "." + ROOT_HOST];
// HMR must ride the tunnel (wss on :443) when the page is served from it.
const hmr = PUBLIC_CLIENT_HOST
  ? { host: PUBLIC_CLIENT_HOST, protocol: "wss" as const, clientPort: 443 }
  : undefined;

export default defineConfig({
  root: __dirname,
  plugins: [
    react({
      // React 16: classic JSX runtime (every file imports React).
      jsxRuntime: "classic",
      // mobx 5 uses legacy decorators — transform them in tsx via babel.
      babel: {
        plugins: [
          ["@babel/plugin-proposal-decorators", { legacy: true }],
          ["@babel/plugin-proposal-class-properties", { loose: true }],
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      client: resolve(__dirname, "src/client"),
      server: resolve(__dirname, "src/server"),
      shared: resolve(__dirname, "src/shared"),
      _integration: resolve(__dirname, "src/_integration"),
    },
  },
  // Some deps (react-spring etc.) reference Node's `global` in browser code.
  define: { global: "globalThis" },
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: ["legacy-js-api", "import", "global-builtin", "color-functions"],
      },
    },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true, port: CLIENT_PORT, proxy, allowedHosts, hmr },
  preview: { host: true, port: CLIENT_PORT, proxy, allowedHosts },
});
