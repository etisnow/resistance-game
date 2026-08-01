import {Browser, Page, expect} from '@playwright/test';

// ---------------------------------------------------------------------------
// Faithful browser driver for the Nechto card game.
//
// Every game component is drawn on a PixiJS canvas, so cards and player badges
// have no DOM nodes to click. Instead we drive the game through the very same
// controller methods the canvas pointer handlers invoke — exposed on the live
// client as `window.__nechto` (see GameController constructor) — and read back
// the controller's MobX observable state, which is exactly what is rendered.
// Real client logic, the socket.io round-trip, the Bun game engine and the
// re-render all run end to end; only the literal canvas hit-test is bypassed.
//
// Deterministic scenarios are arranged via the gated `e2eSetup` server hook
// (enabled by NECHTO_E2E=true), which rewrites a started game into an exact,
// known state before the browser plays it out.
// ---------------------------------------------------------------------------

export interface GcCard {
	id: string;
	uniqueId: string;
	description?: string;
}

export interface GcCardAction {
	menuType: string;
}

export interface GcPlayer {
	id: string;
	nickname: string;
	turnState: string;
	state: string;
	quarantine: number;
	isInfected: boolean | null;
	isThing: boolean | null;
	isConnected: boolean;
	color: string;
}

export interface GcNotification {
	type: string;
	text?: string;
	menu?: {action: string; text: string}[];
	playersToSelect?: string[];
	cards?: Record<string, GcCard>;
}

export interface GcSnapshot {
	currentPlayerId: string | null;
	hand: Record<string, GcCard>;
	handActions: Record<string, GcCardAction[]>;
	players: Record<string, GcPlayer>;
	playersList: string[];
	currentAction: GcNotification | null;
	notifications: GcNotification[];
	gameLog: string[];
	deck: {count: number; topCardType: string | null};
	isPlayerCanCancel: boolean;
}

// Ground truth from the read-only e2eState server probe.
export interface ServerTruthPlayer {
	id: string;
	nickname: string;
	turnState: string;
	quarantine: number;
	state: string;
	hand: {id: string; uniqueId: string | null}[];
	handActions: Record<string, {menuType: string}[]>;
	currentAction: GcNotification | null;
	isThing: boolean;
	isInfected: boolean;
}

export interface ServerTruth {
	gameId: string;
	turnPlayerId: string | null;
	playersList: string[];
	deck: string[];
	discarded: string[];
	isClockwise: boolean;
	gameLog: string[];
	players: ServerTruthPlayer[];
}

export interface AutoplayResult {
	seed: number;
	steps: number;
	winner: 'thing' | 'humans';
	finalLog: string;
	gameLog: string[];
	deaths: {nickname: string; step: number}[];
	infections: {nickname: string; step: number}[];
	finalPlayers: ServerTruthPlayer[];
}

// mulberry32 — deterministic PRNG (matches the server's seeded stream family).
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// Structural shape of `window.__nechto` (the GameController) — only the pieces
// we touch.
interface GcController {
	id: string | null;
	currentPlayerId: string | null;
	hand: Record<string, GcCard>;
	handActions: Record<string, GcCardAction[]>;
	players: Record<string, GcPlayer>;
	playersList: string[];
	currentAction: GcNotification | null;
	notifications: GcNotification[];
	gameLog: {text: string; type: string}[];
	deck: {count: number; topCardType: string | null};
	isPlayerCanCancel: boolean;
	socket: {socket: {emit(event: string, payload?: unknown): void; once(event: string, cb: (d: unknown) => void): void}};
	cardAction(actionType: string, cardUniqueId: string): void;
	selectPlayer(playerId: string): void;
	selectCard(notification: GcNotification | null, cardUniqueId: string): void;
	actionDecision(action: string): void;
	cardPick(): void;
	actionCancel(): void;
	hidENotificationAction(): void;
}

interface GcWindow {
	__nechto?: GcController;
}

// Action type strings as the server expects them (EPlayerActionType values).
export const ACT = 'act';
export const DISCARD = 'discard';
export const TRADE = 'cardTrade';

// Pad a hand up to `size` with a benign filler event card so the turn player
// holds a realistic hand. 'analysis' is a plain playable event with no side
// effect until acted on, and is never the card under test below it.
export function fill(cards: string[], size = 5, filler = 'analysis'): string[] {
	const pad = Math.max(0, size - cards.length);
	return [...cards, ...Array.from({length: pad}, () => filler)];
}

export interface E2ESetupPayload {
	players?: string[];
	turn?: string;
	turnState?: 'inCardAction' | 'inCardPick';
	hands?: Record<string, string[]>;
	deck?: string[];
	discarded?: string[];
	things?: string[];
	infected?: string[];
	doors?: {after: string}[];
	quarantine?: Record<string, number>;
	quarantineFresh?: string[];
	clockwise?: boolean;
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
	// which the server resolves through tryReconnectPlayer. Waits until the game
	// screen and the player's state are restored.
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
			const gc = (window as unknown as GcWindow).__nechto;
			return !!gc && !!gc.currentPlayerId && Object.keys(gc.players).length > 0;
		});
		this.pages[nick] = page;
		this.offline.delete(nick);
	}

	// Read the live controller state for one player's browser.
	async snapshot(nick: string): Promise<GcSnapshot> {
		return this.page(nick).evaluate(() => {
			const gc = (window as unknown as GcWindow).__nechto!;
			const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
			return {
				currentPlayerId: gc.currentPlayerId,
				hand: plain(gc.hand),
				handActions: plain(gc.handActions),
				players: plain(gc.players),
				playersList: plain(gc.playersList),
				currentAction: plain(gc.currentAction),
				notifications: plain(gc.notifications),
				// Спекам нужен только текст строки — тип лога нужен UI, а не проверкам.
				gameLog: plain(gc.gameLog).map((entry) => entry.text),
				deck: plain(gc.deck),
				isPlayerCanCancel: gc.isPlayerCanCancel,
			};
		});
	}

	// Resolve a nickname to its server player id (from any player's view).
	async idOf(nick: string): Promise<string> {
		const snap = await this.snapshot(this.liveNick());
		const player = Object.values(snap.players).find((p) => p.nickname === nick);
		if (!player) throw new Error(`Игрок ${nick} не найден в состоянии`);
		return player.id;
	}

	// Find the uniqueId of a card with the given id in a player's hand.
	async cardUid(nick: string, cardId: string): Promise<string> {
		const snap = await this.snapshot(nick);
		const card = Object.values(snap.hand).find((c) => c.id === cardId);
		if (!card) throw new Error(`У игрока ${nick} нет карты ${cardId} (рука: ${Object.values(snap.hand).map((c) => c.id).join(', ')})`);
		return card.uniqueId;
	}

	// Deterministically rearrange the running game, then wait until every named
	// hand is reflected in that player's own browser (and the turn player is in
	// the requested phase).
	async arrange(payload: E2ESetupPayload): Promise<void> {
		await this.host.evaluate((p) => {
			(window as unknown as GcWindow).__nechto!.socket.socket.emit('e2eSetup', p);
		}, payload);

		const turnNick = payload.turn ?? payload.players?.[0];
		const wantPhase = payload.turnState ?? 'inCardAction';
		for (const [nick, ids] of Object.entries(payload.hands ?? {})) {
			const isTurn = nick === turnNick;
			await this.page(nick).waitForFunction(
				({count, isTurn, wantPhase}) => {
					const gc = (window as unknown as GcWindow).__nechto;
					if (!gc) return false;
					if (Object.keys(gc.hand).length !== count) return false;
					if (!isTurn) return true;
					const want = wantPhase === 'inCardPick' ? 'cardPick' : 'turnCard';
					return gc.currentAction?.type === want;
				},
				{count: ids.length, isTurn, wantPhase},
			);
		}

		// The client's notification queue is purely client-side and is NOT reset
		// by a server game-update, so reveals from a previous test in the same
		// reused session would linger. Clear every page's queue here so each
		// scenario starts with an empty notifications array and assertions only
		// see this scenario's reveals.
		for (const nick of this.nicks) {
			if (this.offline.has(nick)) continue;
			await this.page(nick).evaluate(() => {
				const gc = (window as unknown as GcWindow).__nechto;
				if (gc) gc.notifications.splice(0, gc.notifications.length);
			});
		}
	}

	// --- faithful action drivers (same code paths as the canvas handlers) ---

	async play(nick: string, cardId: string): Promise<void> {
		const uid = await this.cardUid(nick, cardId);
		await this.page(nick).evaluate((u) => (window as unknown as GcWindow).__nechto!.cardAction('act', u), uid);
	}

	async discard(nick: string, cardId: string): Promise<void> {
		const uid = await this.cardUid(nick, cardId);
		await this.page(nick).evaluate((u) => (window as unknown as GcWindow).__nechto!.cardAction('discard', u), uid);
	}

	async offerTrade(nick: string, cardId: string): Promise<void> {
		const uid = await this.cardUid(nick, cardId);
		await this.page(nick).evaluate((u) => (window as unknown as GcWindow).__nechto!.cardAction('cardTrade', u), uid);
	}

	async selectPlayer(nick: string, targetNick: string): Promise<void> {
		const id = await this.idOf(targetNick);
		await this.page(nick).evaluate((i) => (window as unknown as GcWindow).__nechto!.selectPlayer(i), id);
	}

	// Some flows (axe on a door) need to select a non-player target by id.
	async selectId(nick: string, targetId: string): Promise<void> {
		await this.page(nick).evaluate((i) => (window as unknown as GcWindow).__nechto!.selectPlayer(i), targetId);
	}

	async selectNotificationCard(nick: string, cardId: string): Promise<void> {
		const uid = await this.page(nick).evaluate((wantId) => {
			const gc = (window as unknown as GcWindow).__nechto!;
			const action = gc.currentAction;
			const cards = action?.cards ?? {};
			const match = Object.values(cards).find((c) => c.id === wantId);
			return match ? match.uniqueId : null;
		}, cardId);
		if (!uid) throw new Error(`В уведомлении игрока ${nick} нет карты ${cardId}`);
		await this.page(nick).evaluate((u) => {
			const gc = (window as unknown as GcWindow).__nechto!;
			gc.selectCard(gc.currentAction, u);
		}, uid);
	}

	// Decisions render as real DOM buttons (ActionInteracter) — click the button.
	async decide(nick: string, action: string): Promise<void> {
		await this.page(nick).evaluate((a) => (window as unknown as GcWindow).__nechto!.actionDecision(a), action);
	}

	async cardPick(nick: string): Promise<void> {
		await this.page(nick).evaluate(() => (window as unknown as GcWindow).__nechto!.cardPick());
	}

	async cancel(nick: string): Promise<void> {
		await this.page(nick).evaluate(() => (window as unknown as GcWindow).__nechto!.actionCancel());
	}

	async dismissNotifications(nick: string): Promise<void> {
		await this.page(nick).evaluate(() => {
			const gc = (window as unknown as GcWindow).__nechto!;
			while (gc.notifications.length) gc.hidENotificationAction();
		});
	}

	// --- waiting / assertions on the live, rendered state ---

	async waitFor(nick: string, predicate: (snap: GcSnapshot) => boolean, timeout = 15_000): Promise<void> {
		const start = Date.now();
		for (;;) {
			const snap = await this.snapshot(nick);
			if (predicate(snap)) return;
			if (Date.now() - start > timeout) {
				throw new Error(`Условие не выполнилось для игрока ${nick} за ${timeout}мс`);
			}
			await this.page(nick).waitForTimeout(100);
		}
	}

	async expectTurnState(nick: string, expected: string): Promise<void> {
		await this.waitFor(nick, (s) => {
			const me = s.currentPlayerId ? s.players[s.currentPlayerId] : undefined;
			return !!me && me.turnState === expected;
		});
	}

	async playerTurnState(viewerNick: string, ofNick: string): Promise<string> {
		const snap = await this.snapshot(viewerNick);
		const id = (await this.idOf(ofNick));
		return snap.players[id]?.turnState ?? 'unknown';
	}

	// ── Read-only ground-truth probe (e2eState socket hook). Pure observation —
	//    it neither changes game state nor consumes the seeded RNG, so it is safe
	//    to call during a deterministic autoplay for tracking who dies/infects.
	async serverTruth(): Promise<ServerTruth> {
		const nick = this.liveNick();
		return this.page(nick).evaluate(() => {
			return new Promise<ServerTruth>((resolve) => {
				const sock = (window as unknown as GcWindow).__nechto!.socket.socket;
				sock.once('e2eState', (d: unknown) => resolve(d as ServerTruth));
				sock.emit('e2eState', {});
			});
		});
	}

	// Perform one deterministic bot move for a player, mirroring the engine
	// fuzzer: the only inputs are this player's own view (currentAction /
	// handActions / hand) and the seeded RNG, and every move goes through the
	// real client controller of that player's browser.
	private async botMove(player: ServerTruthPlayer, pick: <T>(a: T[]) => T): Promise<void> {
		const nick = player.nickname;
		const ca = player.currentAction;
		if (!ca) return;
		switch (ca.type) {
			case 'cardPick':
				await this.cardPick(nick);
				return;
			case 'turnCard':
			case 'offenseTradeCard':
			case 'defenseTradeCard': {
				const playable = Object.entries(player.handActions).filter(([, acts]) => acts.length > 0);
				if (!playable.length) return;
				// Help the game converge like the engine fuzzer: the Thing prefers to
				// pass/play its infect card when it legally can.
				let chosen = pick(playable);
				if (player.isThing) {
					const infectUid = player.hand.find((c) => c.id === 'infect')?.uniqueId;
					const infect = playable.find(([uid]) => uid === infectUid);
					if (infect) chosen = infect;
				}
				const [uid, acts] = chosen;
				const menuType = pick(acts).menuType;
				await this.page(nick).evaluate(
					({m, u}) => (window as unknown as GcWindow).__nechto!.cardAction(m, u),
					{m: menuType, u: uid},
				);
				return;
			}
			case 'playerSelect': {
				const ids = ca.playersToSelect ?? [];
				if (!ids.length) return;
				await this.selectId(nick, pick(ids));
				return;
			}
			case 'selectCard': {
				const cards = Object.values(ca.cards ?? {});
				if (!cards.length) return;
				const uid = pick(cards).uniqueId;
				await this.page(nick).evaluate((u) => {
					const gc = (window as unknown as GcWindow).__nechto!;
					gc.selectCard(gc.currentAction, u);
				}, uid);
				return;
			}
			case 'actionDecision': {
				const menu = ca.menu ?? [];
				if (!menu.length) return;
				await this.decide(nick, pick(menu).action);
				return;
			}
		}
	}

	// Play a whole game to its end with a deterministic bot — no scripted setup,
	// only the seed (set on the server before start) drives the deal, and the
	// same seed drives the bot's choices. One read-only probe per step supplies
	// every player's own view; tracks deaths/infections over the game.
	async autoplay(seed: number, opts: {maxSteps?: number; debug?: boolean} = {}): Promise<AutoplayResult> {
		const maxSteps = opts.maxSteps ?? 1500;
		const rand = mulberry32(seed);
		const pick = <T,>(a: T[]): T => a[Math.floor(rand() * a.length)]!;

		const deaths: {nickname: string; step: number}[] = [];
		const infections: {nickname: string; step: number}[] = [];
		const deadSeen = new Set<string>();
		const infectedSeen = new Set<string>();
		const isOver = (log: string[]): boolean => {
			const last = log[log.length - 1];
			return last === 'Нечто победило' || last === 'Нечто проиграло';
		};
		const track = (truth: ServerTruth) => {
			for (const p of truth.players) {
				if (p.turnState === 'dead' && !deadSeen.has(p.id)) {
					deadSeen.add(p.id);
					deaths.push({nickname: p.nickname, step: steps});
				}
				if (p.isInfected && !infectedSeen.has(p.id)) {
					infectedSeen.add(p.id);
					infections.push({nickname: p.nickname, step: steps});
				}
			}
		};

		// A change in ANY of these means the last action took effect (most actions
		// don't grow the log — they change a turnState/currentAction/hand instead).
		const sig = (t: ServerTruth): string =>
			`${t.gameLog.length}|${t.turnPlayerId}|` +
			t.players
				.map((p) => `${p.nickname}:${p.turnState}:${p.currentAction?.type ?? ''}:${p.hand.length}:${p.quarantine}:${p.isInfected ? 1 : 0}:${p.state}`)
				.join(';');

		let steps = 0;
		let stuck = 0;
		let truth = await this.serverTruth();
		// Baseline: the Thing starts infected — record it as already-known.
		for (const p of truth.players) {
			if (p.isInfected) infectedSeen.add(p.id);
		}

		while (!isOver(truth.gameLog)) {
			if (steps++ > maxSteps) {
				throw new Error(`Игра с сидом ${seed} не завершилась за ${maxSteps} шагов. Хвост лога: ${truth.gameLog.slice(-8).join(' | ')}`);
			}

			// First player (fixed order) with a pending action — from the single probe.
			const byNick = (n: string) => truth.players.find((p) => p.nickname === n);
			let actor: ServerTruthPlayer | undefined;
			for (const nick of this.nicks) {
				if (this.offline.has(nick)) continue;
				const p = byNick(nick);
				if (p && p.currentAction) {
					actor = p;
					break;
				}
			}

			if (!actor) {
				if (++stuck > 40) {
					throw new Error(`Игра с сидом ${seed} застряла: никто не может ходить. Хвост: ${truth.gameLog.slice(-8).join(' | ')}`);
				}
				await this.host.waitForTimeout(40);
				truth = await this.serverTruth();
				continue;
			}
			stuck = 0;

			const before = sig(truth);
			const actType = actor.currentAction?.type;
			await this.botMove(actor, pick);

			// Wait until the action takes effect (state signature changes or the
			// game ends), so the next read sees fresh, settled state — keeps the run
			// ordered and reproducible without depending on the log growing.
			const waitStart = Date.now();
			let changed = false;
			for (;;) {
				truth = await this.serverTruth();
				if (sig(truth) !== before || isOver(truth.gameLog)) {
					changed = true;
					break;
				}
				if (Date.now() - waitStart > 1500) break;
				await this.host.waitForTimeout(15);
			}
			if (opts.debug && (!changed || steps % 50 === 0)) {
				// eslint-disable-next-line no-console
				console.log(`[seed ${seed}] step ${steps} ${actor.nickname}/${actType}${changed ? '' : ' NO-OP'} | ${truth.gameLog.slice(-1)[0] ?? ''}`);
			}
			track(truth);
		}

		const finalLog = truth.gameLog[truth.gameLog.length - 1] ?? '';
		return {
			seed,
			steps,
			winner: finalLog === 'Нечто победило' ? 'thing' : 'humans',
			finalLog,
			gameLog: truth.gameLog,
			deaths,
			infections,
			finalPlayers: truth.players,
		};
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
// BEFORE the deal, so the shuffle/deal and all in-game randomness are fully
// reproducible — the only injected input to an otherwise untouched real game.
export async function startGame(browser: Browser, nicks: string[], seed?: number): Promise<GameSession> {
	if (nicks.length < 4) throw new Error('Нужно минимум 4 игрока для старта');
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
		await pages[host].waitForFunction(() => !!(window as unknown as GcWindow).__nechto);
		await pages[host].evaluate((s) => {
			(window as unknown as GcWindow).__nechto!.socket.socket.emit('e2eSeed', {seed: s});
		}, seed);
	}

	const startButton = pages[host].getByRole('button', {name: 'Начать игру'});
	await expect(startButton).toBeEnabled({timeout: 20_000});
	await startButton.click();

	for (const nick of nicks) {
		await expect(pages[nick]!.locator('canvas')).toBeVisible({timeout: 20_000});
		await pages[nick]!.waitForFunction(() => !!(window as unknown as GcWindow).__nechto);
	}

	return new GameSession(browser, pages, nicks);
}
