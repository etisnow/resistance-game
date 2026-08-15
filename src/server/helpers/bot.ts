import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {GameServer} from 'server/server/GameServer';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {ENotificationAction} from 'shared/enum/notifications';

// Server-side bot opponents for the ?withBots=true dev mode. A real human plays
// in the browser; these emulated players answer their own prompts. Decisions are
// driven by the game's seeded RNG (so a seed reproduces the bot choices too) and
// fired one action per second so the human can follow along.

const BOT_ACTION_DELAY_MS = 1000;

// One pending timer per game (so re-triggering the scheduler is idempotent).
const timers = new WeakMap<Game, ReturnType<typeof setTimeout>>();

const pick = <T>(arr: readonly T[] | undefined, rng: () => number): T | undefined => {
	if (!arr || arr.length === 0) return undefined;
	return arr[Math.floor(rng() * arr.length)];
};

// Perform a single bot action based on what the player is currently asked for.
const performBotAction = (gameServer: GameServer, game: Game, player: Player): void => {
	const action = player.currentAction;
	if (!action) return;
	switch (action.type) {
		case ENotificationAction.actionDecision: {
			const choice = pick(action.menu, game.rng);
			if (choice) gameServer.playerAction({player, actionType: EPlayerActionType.actionDecision, action: choice.action});
			return;
		}
		case ENotificationAction.playerSelect: {
			const selectedPlayerId = pick(action.playersToSelect, game.rng);
			if (selectedPlayerId) gameServer.playerAction({player, actionType: EPlayerActionType.playerSelect, selectedPlayerId});
			return;
		}
		default:
			return;
	}
};

const findActionableBot = (game: Game): Player | undefined => {
	for (const playerId of game.playersList) {
		const player = game.players[playerId];
		if (player && player.isBot && player.currentAction) return player;
	}
	return undefined;
};

export const gameHasBots = (game: Game): boolean =>
	Object.values(game.players).some((p) => p.isBot);

// Schedule the next bot move (if any bot is waiting to act) one second from now;
// after it resolves, reschedule — so consecutive bot moves are paced 1s apart
// and the loop naturally pauses whenever the table waits on the human. Call
// after the human acts to resume the bots.
//
// TODO (фаза 4): в «Сопротивлении» голосуют все разом, и очередь по секунде
// растянет шесть голосов на шесть секунд — боты должны отвечать параллельно.
export const scheduleBots = (gameServer: GameServer, game: Game): void => {
	const existing = timers.get(game);
	if (existing) clearTimeout(existing);
	if (!game.gameInProcess) return;
	const bot = findActionableBot(game);
	if (!bot) return; // waiting on the human (or nothing to do)

	const timer = setTimeout(() => {
		timers.delete(game);
		try {
			if (game.gameInProcess) performBotAction(gameServer, game, bot);
		} catch (e) {
			console.error('[bot] action error:', e);
		}
		scheduleBots(gameServer, game);
	}, BOT_ACTION_DELAY_MS);
	timers.set(game, timer);
};
