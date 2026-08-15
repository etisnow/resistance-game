import {expect} from '@playwright/test';
import type {Browser, Page} from '@playwright/test';

// Драйвер живой партии для Playwright-спеков: игра идёт настоящая (реальные
// клиент, сервер и сокет), а спек ходит через тот же контроллер, который дёргают
// обработчики канваса — клиент выставляет его как `window.__resistance` (см.
// GameController), — и читает обратно его наблюдаемое состояние.
//
// TODO (фаза 4): вернуть сюда `arrange` — раскладку сценария из известного
// состояния (роли, фаза раунда). Серверная её половина ждёт в e2eSetup.ts.

export interface GcPlayer {
	id: string;
	nickname: string | null;
	color: string;
	avatar: string;
	isConnected: boolean;
	isReady: boolean;
	isYou: boolean;
	turnState: string;
	state: string;
}

export interface GcNotification {
	type: string;
	text?: string;
	menu?: {text: string; action: string}[];
	playersToSelect?: string[];
	isSpiesWin?: boolean;
}

export interface GcRound {
	phase: string;
	missionIndex: number;
	missionResults: (boolean | null)[];
	leaderId: string;
	rejectCount: number;
	team: string[];
	teamSize: number;
	answeredIds: string[];
	revealedVotes: Record<string, boolean> | null;
	isRolesRevealed: boolean;
}

export interface GcSnapshot {
	currentPlayerId: string | null;
	players: Record<string, GcPlayer>;
	playersList: string[];
	turnPlayerId: string | null;
	currentAction: GcNotification | null;
	notifications: GcNotification[];
	gameLog: string[];
	round: GcRound | null;
}

// Structural shape of `window.__resistance` (the GameController) — only the
// pieces the specs touch. Not imported from client scope: this code runs inside
// the page, and the real controller carries mobx observables.
interface GcController {
	currentPlayerId: string | null;
	players: Record<string, GcPlayer>;
	playersList: string[];
	turnPlayerId: string | null;
	currentAction: GcNotification | null;
	notifications: GcNotification[];
	gameLog: {text: string}[];
	round: GcRound | null;
	selectPlayer(playerId: string): void;
	actionDecision(action: string): void;
	hidENotificationAction(): void;
	socket: {socket: {emit(event: string, payload?: unknown): void}};
}

interface GcWindow {
	__resistance?: GcController;
}

export class GameSession {
	readonly pages: Record<string, Page>;
	readonly nicks: string[];
	private readonly browser: Browser;
	// Nicks currently disconnected (no live page) — skipped on close().
	private readonly offline = new Set<string>();

	constructor(browser: Browser, pages: Record<string, Page>, nicks: string[]) {
		this.browser = browser;
		this.pages = pages;
		this.nicks = nicks;
	}

	page(nick: string): Page {
		const p = this.pages[nick];
		if (!p) throw new Error(`Нет страницы для игрока ${nick}`);
		return p;
	}

	// A nick whose browser is currently connected — used as the default viewer.
	private liveNick(): string {
		const nick = this.nicks.find((n) => !this.offline.has(n));
		if (!nick) throw new Error('Нет ни одного подключённого игрока');
		return nick;
	}

	get host(): Page {
		return this.page(this.liveNick());
	}

	async close(): Promise<void> {
		for (const nick of this.nicks) {
			if (this.offline.has(nick)) continue;
			await this.page(nick).context().close();
		}
	}

	// Drop a player's connection (closes the browser context → socket disconnect),
	// then wait until a still-connected peer observes them as offline.
	async disconnect(nick: string): Promise<void> {
		const id = await this.idOf(nick);
		await this.page(nick).context().close();
		this.offline.add(nick);
		await this.waitFor(this.liveNick(), (s) => s.players[id]?.isConnected === false);
	}

	// Reconnect a previously disconnected player via the real launcher UI: a
	// fresh browser opens the app, the player types their nickname and clicks the
	// (still-listed) running game — the exact connectGame the launcher sends,
	// which the server resolves through tryReconnectPlayer.
	async reconnect(nick: string): Promise<void> {
		const host = this.nicks[0]!;
		const context = await this.browser.newContext();
		const page = await context.newPage();
		await page.goto('/');
		await expect(page.getByRole('heading', {name: 'Вход'})).toBeVisible();
		await page.getByPlaceholder('введи ник').fill(nick);
		const joinButton = page.getByRole('button', {name: new RegExp(`Игра созданная ${host}`)});
		await expect(joinButton).toBeVisible();
		await joinButton.click();
		await expect(page.locator('canvas')).toBeVisible({timeout: 20_000});
		await page.waitForFunction(() => {
			const gc = (window as unknown as GcWindow).__resistance;
			return !!gc && !!gc.currentPlayerId && Object.keys(gc.players).length > 0;
		});
		this.pages[nick] = page;
		this.offline.delete(nick);
	}

	// Read the live controller state for one player's browser.
	async snapshot(nick: string): Promise<GcSnapshot> {
		return this.page(nick).evaluate(() => {
			const gc = (window as unknown as GcWindow).__resistance!;
			const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
			return {
				currentPlayerId: gc.currentPlayerId,
				players: plain(gc.players),
				playersList: plain(gc.playersList),
				turnPlayerId: gc.turnPlayerId,
				currentAction: plain(gc.currentAction),
				notifications: plain(gc.notifications),
				// Спекам нужен только текст строки — тип лога нужен UI, а не проверкам.
				gameLog: plain(gc.gameLog).map((entry) => entry.text),
				round: plain(gc.round),
			};
		});
	}

	/** Ник игрока по его серверному id. */
	async nickOf(playerId: string): Promise<string> {
		const snap = await this.snapshot(this.liveNick());
		const nickname = snap.players[playerId]?.nickname;
		if (!nickname) throw new Error(`Игрок ${playerId} не найден в состоянии`);
		return nickname;
	}

	/** Кому сейчас задан вопрос такого типа. */
	async whoIsAsked(type: string): Promise<string[]> {
		const asked: string[] = [];
		for (const nick of this.nicks) {
			if (this.offline.has(nick)) continue;
			const snap = await this.snapshot(nick);
			if (snap.currentAction?.type === type) asked.push(nick);
		}
		return asked;
	}

	// Resolve a nickname to its server player id (from any player's view).
	async idOf(nick: string): Promise<string> {
		const snap = await this.snapshot(this.liveNick());
		const player = Object.values(snap.players).find((p) => p.nickname === nick);
		if (!player) throw new Error(`Игрок ${nick} не найден в состоянии`);
		return player.id;
	}

	// Wait until this player's browser sees the expected state.
	async waitFor(nick: string, predicate: (snapshot: GcSnapshot) => boolean, timeoutMs = 15_000): Promise<void> {
		const deadline = Date.now() + timeoutMs;
		let last: GcSnapshot | null = null;
		while (Date.now() < deadline) {
			last = await this.snapshot(nick);
			if (predicate(last)) return;
			await this.page(nick).waitForTimeout(50);
		}
		throw new Error(`Не дождались состояния у игрока ${nick}. Последнее: ${JSON.stringify(last)}`);
	}

	// Ответ на вопрос с кнопками: голос «За / Против», карта миссии.
	async decide(nick: string, action: string): Promise<void> {
		await this.page(nick).evaluate((a) => (window as unknown as GcWindow).__resistance!.actionDecision(a), action);
	}

	// Выбор игрока за столом: лидер набирает команду.
	async selectPlayer(nick: string, targetNick: string): Promise<void> {
		const targetId = await this.idOf(targetNick);
		await this.page(nick).evaluate((i) => (window as unknown as GcWindow).__resistance!.selectPlayer(i), targetId);
	}
}

export async function newPlayer(browser: Browser, nick: string): Promise<Page> {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto('/');
	await expect(page.getByRole('heading', {name: 'Вход'})).toBeVisible();
	await page.getByPlaceholder('введи ник').fill(nick);
	return page;
}

// Assemble a real, started game: host creates, the rest join + ready, host
// starts. Returns a session keyed by nickname (nicks[0] is the host).
//
// When `seed` is given, it is set on the server (via the gated e2eSeed hook)
// BEFORE the deal, so all in-game randomness is fully reproducible — the only
// injected input to an otherwise untouched real game.
export async function startGame(browser: Browser, nicks: string[], seed?: number): Promise<GameSession> {
	if (nicks.length < 5) throw new Error('Нужно минимум 5 игроков для старта');
	const host = nicks[0]!;
	const pages: Record<string, Page> = {};

	pages[host] = await newPlayer(browser, host);
	await pages[host].getByRole('button', {name: 'Создай игру'}).click();
	await expect(pages[host].getByRole('heading', {name: 'Лобби игры'})).toBeVisible();

	for (const nick of nicks.slice(1)) {
		const page = await newPlayer(browser, nick);
		const joinButton = page.getByRole('button', {name: new RegExp(`Игра созданная ${host}`)});
		await expect(joinButton).toBeVisible();
		await joinButton.click();
		await expect(page.getByRole('heading', {name: 'Лобби игры'})).toBeVisible();
		await page.getByRole('button', {name: 'Я готов к игре!'}).click();
		pages[nick] = page;
	}

	// Seed the server's RNG before the deal (no other intervention).
	if (seed !== undefined) {
		await pages[host].waitForFunction(() => !!(window as unknown as GcWindow).__resistance);
		await pages[host].evaluate((s) => {
			(window as unknown as GcWindow).__resistance!.socket.socket.emit('e2eSeed', {seed: s});
		}, seed);
	}

	const startButton = pages[host].getByRole('button', {name: 'Начать игру'});
	await expect(startButton).toBeEnabled({timeout: 20_000});
	await startButton.click();

	for (const nick of nicks) {
		await expect(pages[nick]!.locator('canvas')).toBeVisible({timeout: 20_000});
		await pages[nick]!.waitForFunction(() => !!(window as unknown as GcWindow).__resistance);
	}

	return new GameSession(browser, pages, nicks);
}
