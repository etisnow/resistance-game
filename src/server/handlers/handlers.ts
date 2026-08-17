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
		const data = (payload ?? {}) as {
			nickname?: unknown;
			withBots?: unknown;
			seed?: unknown;
			firstPanic?: unknown;
			hand?: unknown;
			botCount?: unknown;
			activeRole?: unknown;
		};
		const nickname = asString(data.nickname);
		if (!nickname) return;
		const bots = data.withBots === true
			? {
				withBots: true,
				seed: typeof data.seed === 'number' ? data.seed : undefined,
				firstPanic: asString(data.firstPanic),
				hand: Array.isArray(data.hand) ? data.hand.filter((c): c is string => typeof c === 'string') : undefined,
				botCount: typeof data.botCount === 'number' ? data.botCount : undefined,
				activeRole: asString(data.activeRole),
			}
			: undefined;
		gameServer.createGame({nickname, socket, bots});
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

	socket.on(EClientEventType.setGameOptions, (payload: unknown) => safe('setGameOptions', () => {
		const data = (payload ?? {}) as {withMerlin?: unknown, withPercival?: unknown};
		const withMerlin = typeof data.withMerlin === 'boolean' ? data.withMerlin : undefined;
		const withPercival = typeof data.withPercival === 'boolean' ? data.withPercival : undefined;
		if (withMerlin === undefined && withPercival === undefined) return;
		const player = gameServer.getPlayerBySocket(socket);
		if (!player) return;
		gameServer.setGameOptions({player, withMerlin, withPercival});
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
			selectedPlayerId: asString(data.selectedPlayerId),
			action: asString(data.action),
		});
	}));

	socket.on('disconnect', () => safe('disconnect', () => {
		const player = gameServer.getPlayerBySocket(socket);
		// Сокет мёртв — в карте ему больше не место: иначе рассылка лобби и поиск
		// игроков ходят по трупам, а карта растёт до бесконечности.
		gameServer.sockets.delete(socket);
		if (!player) return;
		// Игрок уже переехал на новое подключение (реконнект / замещение тем же
		// ником) — отключилась именно старая вкладка, живого игрока это не
		// касается. Без этой проверки вернувшийся игрок тут же снова становился
		// «офлайн», а комната — брошенной.
		if (player.socket !== socket) return;
		player.makeOffline();
	}));
};
