import { test, expect, Browser, Page } from "@playwright/test";

// Full browser playthrough: a host plus four joiners assemble in a lobby, ready
// up, and the host starts a real game (no mock mode) — driving the actual Bun
// socket.io server and game engine end to end.

async function newPlayer(browser: Browser, nick: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible();
  await page.getByPlaceholder("введи ник").fill(nick);
  return page;
}

test("host + joiners start and play a real game in the browser", async ({ browser }) => {
  const HOST = "Host";
  const joiners = ["Pavel", "Gena", "Vena", "Inna"];

  // Host creates the game.
  const host = await newPlayer(browser, HOST);
  await host.getByRole("button", { name: "Создай игру" }).click();
  await expect(host.getByRole("heading", { name: "Лобби игры" })).toBeVisible();

  // Each joiner sees the host's game in the lobby list, joins, and readies up.
  const joinerPages: Page[] = [];
  for (const nick of joiners) {
    const page = await newPlayer(browser, nick);
    const joinButton = page.getByRole("button", { name: new RegExp(`Игра созданная ${HOST}`) });
    await expect(joinButton).toBeVisible();
    await joinButton.click();
    await expect(page.getByRole("heading", { name: "Лобби игры" })).toBeVisible();
    await page.getByRole("button", { name: "Я готов к игре!" }).click();
    joinerPages.push(page);
  }

  // Once everyone is ready, the host's start button enables.
  const startButton = host.getByRole("button", { name: "Начать игру" });
  await expect(startButton).toBeEnabled({ timeout: 20_000 });
  await startButton.click();

  // The game is on: the lobby is gone and the PixiJS table canvas is rendered
  // for the host and the joiners.
  for (const page of [host, ...joinerPages]) {
    await expect(page.getByRole("heading", { name: "Лобби игры" })).toHaveCount(0);
    await expect(page.locator("canvas")).toBeVisible({ timeout: 20_000 });
  }

  // Clean up contexts.
  for (const page of [host, ...joinerPages]) {
    await page.context().close();
  }
});
