import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT) || 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // PixiJS needs WebGL; enable software (SwiftShader) GL for headless runs.
        launchOptions: {
          args: [
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist",
            "--enable-webgl",
          ],
        },
      },
    },
  ],
  webServer: {
    // Run the Bun server from source; it serves the prebuilt dist/client.
    // RESISTANCE_E2E enables the gated e2e socket hooks (inert in production).
    //
    // Переменные — полем env, а не префиксом в командной строке: на Windows
    // playwright запускает команду через cmd.exe, и `VAR=value cmd` там не
    // синтаксис присваивания, а попытка выполнить программу с таким именем.
    command: `bun src/server/index.ts`,
    env: {
      RESISTANCE_E2E: 'true',
      PORT: String(PORT),
    },
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
