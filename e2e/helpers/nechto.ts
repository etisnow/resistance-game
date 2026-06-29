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

// Structural shape of `window.__nechto` (the GameController) — only the pieces
// we touch.
interface GcController {
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
	socket: {socket: {emit(event: string, payload?: unknown): void}};
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
	constructor(pages: Record<string, Page>, nicks: string[]) {
		this.pages = pages;
		this.nicks = nicks;
	}

	page(nick: string): Page {
		const p = this.pages[nick];
		if (!p) throw new Error(`Нет страницы для игрока ${nick}`);
		return p;
	}

	get host(): Page {
		return this.page(this.nicks[0]!);
	}

	async close(): Promise<void> {
		for (const nick of this.nicks) {
			await this.page(nick).context().close();
		}
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
				gameLog: plain(gc.gameLog),
				deck: plain(gc.deck),
				isPlayerCanCancel: gc.isPlayerCanCancel,
			};
		});
	}

	// Resolve a nickname to its server player id (from any player's view).
	async idOf(nick: string): Promise<string> {
		const snap = await this.snapshot(this.nicks[0]!);
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
}

async function newPlayer(browser: Browser, nick: string): Promise<Page> {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto('/');
	await expect(page.getByRole('heading', {name: 'Вход'})).toBeVisible();
	await page.getByPlaceholder('введи ник').fill(nick);
	return page;
}

// Assemble a real, started game: host creates, the rest join + ready, host
// starts. Returns a session keyed by nickname (nicks[0] is the host).
export async function startGame(browser: Browser, nicks: string[]): Promise<GameSession> {
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

	const startButton = pages[host].getByRole('button', {name: 'Начать игру'});
	await expect(startButton).toBeEnabled({timeout: 20_000});
	await startButton.click();

	for (const nick of nicks) {
		await expect(pages[nick]!.locator('canvas')).toBeVisible({timeout: 20_000});
		await pages[nick]!.waitForFunction(() => !!(window as unknown as GcWindow).__nechto);
	}

	return new GameSession(pages, nicks);
}
