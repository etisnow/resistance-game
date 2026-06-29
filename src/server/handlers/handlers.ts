import {GameServer} from 'server/server/GameServer';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {EClientEventType} from 'shared/enum/enumClientEvents';
import type {IGameSocket} from 'shared/interfaces/socket';
import {registerE2EHandlers} from 'server/handlers/e2eSetup';

// Every socket handler runs inside this wrapper: a bug while handling one
// client message is logged and contained, never propagated to crash the server.
const safe = (label: string, fn: () => void) => {
	try {
		fn();
	} catch (e) {
		console.error(`[handler:${label}] error:`, e);
	}
};

const asString = (value: unknown): string | undefined =>
	typeof value === 'string' ? value : undefined;

export const registerHandlers = (gameServer: GameServer, socket: IGameSocket) => {
	registerE2EHandlers(gameServer, socket);

	socket.on(EClientEventType.createGame, (payload: unknown) => safe('createGame', () => {
		const nickname = asString((payload as { nickname?: unknown })?.nickname);
		if (!nickname) return;
		gameServer.createGame({nickname, socket});
	}));

	socket.on(EClientEventType.leaveGame, () => safe('leaveGame', () => {
		const player = gameServer.getPlayerBySocket(socket);
		if (!player) return;
		gameServer.leaveGame({player});
	}));

	socket.on(EClientEventType.connectGame, (payload: unknown) => safe('connectGame', () => {
		const data = (payload ?? {}) as { nickname?: unknown; gameId?: unknown };
		const nickname = asString(data.nickname);
		const gameId = asString(data.gameId);
		if (!nickname || !gameId) return;
		gameServer.connectGame({nickname, socket, gameId});
	}));

	socket.on(EClientEventType.kickPlayer, (payload: unknown) => safe('kickPlayer', () => {
		const playerId = asString((payload as { playerId?: unknown })?.playerId);
		if (!playerId) return;
		gameServer.kickPlayer({playerId});
	}));

	socket.on(EClientEventType.startGame, () => safe('startGame', () => {
		const player = gameServer.getPlayerBySocket(socket);
		if (!player) return;
		gameServer.startGame({player});
	}));

	socket.on(EClientEventType.toggleReadyGame, () => safe('toggleReadyGame', () => {
		const player = gameServer.getPlayerBySocket(socket);
		if (!player) return;
		gameServer.toggleReady({player});
	}));

	socket.on(EClientEventType.markPlayer, (payload: unknown) => safe('markPlayer', () => {
		const markPlayerId = asString((payload as { playerId?: unknown })?.playerId);
		const player = gameServer.getPlayerBySocket(socket);
		if (!player || !markPlayerId) return;
		gameServer.markPlayer({player, markPlayerId});
	}));

	socket.on(EClientEventType.playerAction, (payload: unknown) => safe('playerAction', () => {
		const data = (payload ?? {}) as {
			actionType?: unknown;
			cardUniqueId?: unknown;
			selectedPlayerId?: unknown;
			action?: unknown;
		};
		const actionType = data.actionType as EPlayerActionType | undefined;
		if (!actionType) return;
		const player = gameServer.getPlayerBySocket(socket);
		if (!player) return;
		gameServer.playerAction({
			player,
			actionType,
			cardUniqueId: asString(data.cardUniqueId),
			selectedPlayerId: asString(data.selectedPlayerId),
			action: asString(data.action),
		});
	}));

	socket.on('disconnect', () => safe('disconnect', () => {
		const player = gameServer.getPlayerBySocket(socket);
		if (!player) {
			gameServer.sockets.delete(socket);
			return;
		}
		player.makeOffline();
	}));
};
