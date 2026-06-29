import { test, expect } from "@playwright/test";

// Smoke: the React+PixiJS client bundle loads, mounts, connects to the Bun
// socket.io server, and a player can create a game and land in the lobby.
test("launcher loads and a host can create a game", async ({ page }) => {
  await page.goto("/");

  // App mounted -> launcher screen.
  await expect(page.getByRole("heading", { name: "Вход" })).toBeVisible();

  const nick = page.getByPlaceholder("введи ник");
  await expect(nick).toBeVisible();
  await nick.fill("Host");

  await page.getByRole("button", { name: "Создай игру" }).click();

  // Host transitions into the game lobby as the host.
  await expect(page.getByRole("heading", { name: "Лобби игры" })).toBeVisible();
  await expect(page.getByText("Host", { exact: false })).toBeVisible();
  await expect(page.getByText("Хост", { exact: false })).toBeVisible();
});
