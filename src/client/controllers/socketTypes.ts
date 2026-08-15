// Shapes of the payloads the server sends over socket.io, modelled locally on the
// client (the authoritative formatters live in server scope and must not be imported
// across the client/server boundary). Keep these in sync with
// server/formatters/formatOutgoingEvents.ts.
import type { EGameState } from 'shared/enum/common';
import type INotificationAction from 'shared/interfaces/notification';
import type { IGameLogEntry } from 'shared/interfaces/gameLog';
import type Player from 'client/models/Player';

export type IPlayersMap = { [key: string]: Player | null };

export interface IGameUpdatePayload {
	players: IPlayersMap;
	playersList: string[];
	turnPlayerId: string | null;
	gameLog: IGameLogEntry[];
	currentAction: INotificationAction | null;
	state: EGameState;
	currentPlayer: Player;
	hostPlayerId: string;
	isClockwise: boolean;
}

export interface IGameConnectionSuccessPayload {
	players: IPlayersMap;
	player: Player;
	game: { id: string };
	currentPlayer: Player;
}

export interface ICommonErrorPayload {
	error: string;
}

export interface ILobbyGameItem {
	gameId: string;
	hostName: string;
	playersCount: number;
	isStarted: boolean;
}

export interface ILobbyUpdatePayload {
	games: ILobbyGameItem[];
}

export interface ITimerPayload {
	text: string;
	seconds: number;
	playerId: string;
}
