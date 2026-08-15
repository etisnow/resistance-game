import { test, expect } from "@playwright/test";

// Стартовые экраны до лобби: прелоад ассетов PIXI и заглушка без WebGL.

test("ассеты грузятся до лобби, экран загрузки показывает прогресс", async ({ page }) => {
  const failed: string[] = [];
  page.on("requestfailed", (r) => failed.push(r.url()));
  // Держим картинки на воротах: локально прелоад иначе успевает завершиться
  // до первой проверки, и тест ловил бы экран загрузки по везению.
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(/\.(png|jpg|svg)$/, async (route) => {
    await gate;
    await route.continue();
  });

  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator(".loading-screen")).toBeVisible();
  await expect(page.locator(".loading-label")).toHaveText(/Загрузка… \d+%/);
  // Пока ассеты не отданы, лобби не показывается.
  await expect(page.getByPlaceholder("введи ник")).toHaveCount(0);

  release();
  // Лобби появляется только после прелоада.
  await expect(page.getByPlaceholder("введи ник")).toBeVisible({ timeout: 60_000 });
  expect(failed).toEqual([]);

  // К моменту лобби картинки действительно скачаны, а не ждут первого рендера.
  const pending = await page.evaluate(() => {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const images = entries.filter((e) => /\.(png|jpg|svg)(\?|$)/.test(e.name));
    return { total: images.length, empty: images.filter((e) => e.decodedBodySize === 0 && e.transferSize === 0).length };
  });
  // Порог — «весь набор, а не пара штук»: столько картинок в resources.ts за
  // вычетом запаса. Проверка не про точное число, а про то, что прелоад дошёл
  // до конца; с новыми ассетами (фаза 3) порог поднимется.
  expect(pending.total).toBeGreaterThan(12);
  expect(pending.empty).toBe(0);
});

test("без WebGL вместо игры показывается просьба его включить", async ({ page }) => {
  // Гасим webgl-контекст так же, как это делает браузер с отключённым ускорением.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (String(type).includes("webgl")) return null;
      return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Графика не запустилась" })).toBeVisible();
  // Инструкция — под текущий браузер (тесты гоняются в Chromium).
  await expect(page.locator(".webgl-browser")).toHaveText(/^Chrome:/);
  await expect(page.locator(".webgl-address code")).toHaveText("chrome://settings/system");
  // До лобби не пускаем: играть всё равно нельзя.
  await expect(page.getByPlaceholder("введи ник")).toHaveCount(0);
});

test("инструкция выбирается по браузеру", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (String(type).includes("webgl")) return null;
      return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(navigator, "userAgent", {
      get: () => "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
    });
  });

  await page.goto("/");

  await expect(page.locator(".webgl-browser")).toHaveText(/^Firefox:/);
  await expect(page.locator(".webgl-address code")).toHaveText("about:config");
  await expect(page.getByText("webgl.disabled", { exact: false })).toBeVisible();
});
