import {GameServer} from 'server/server/GameServer';
import type {IGameSocket} from 'shared/interfaces/socket';
import {filter} from 'lodash';

// E2E-ONLY hooks, gated behind RESISTANCE_E2E=true and therefore inert in
// production. They let a Playwright spec pin the game's seed and read server
// truth about a running game, so a browser session can assert on state the UI
// does not show.
//
// TODO (фаза 1): вернуть сюда рассадку сценария — раздачу ролей и фазу раунда,
// чтобы спек мог начать партию из заранее известного состояния.

export const registerE2EHandlers = (gameServer: GameServer, socket: IGameSocket) => {
	if (process.env.RESISTANCE_E2E !== 'true') return;

	// Override THIS game's seed (every game is already seeded; this just pins it
	// to a known value) so a whole playthrough is reproducible. Call BEFORE
	// startGame. Also puts the server into clean real-game mode (no mock) so the
	// seeded playthrough is the genuine deal.
	socket.on('e2eSeed', (payload: unknown) => {
		try {
			const seed = (payload as {seed?: unknown})?.seed;
			const player = gameServer.getPlayerBySocket(socket);
			if (player && player.game && typeof seed === 'number') {
				player.game.reseed(seed);
			}
			gameServer.isMock = false;
			gameServer.ignoreChecks = false;
		} catch (e) {
			console.error('[handler:e2eSeed] error:', e);
		}
	});

	// Lets a spec read the resolved game/player ids if it wants server truth.
	socket.on('e2eState', (_payload: unknown) => {
		try {
			const player = gameServer.getPlayerBySocket(socket);
			if (!player || !player.game) return;
			const game = player.game;
			const players = filter(game.players, () => true).map((p) => ({
				id: p.id,
				nickname: p.nickname,
				turnState: p.turnState,
				state: p.state,
				currentAction: p.currentAction,
			}));
			socket.emit('e2eState', {
				gameId: game.id,
				turnPlayerId: game.turnPlayerId,
				playersList: game.playersList,
				isClockwise: game.isClockwise,
				gameLog: game.gameLog.map((entry) => entry.text),
				players,
			});
		} catch (e) {
			console.error('[handler:e2eState] error:', e);
		}
	});
};
