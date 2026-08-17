// Shapes of the payloads the server sends over socket.io, modelled locally on the
// client (the authoritative formatters live in server scope and must not be imported
// across the client/server boundary). Keep these in sync with
// server/formatters/formatOutgoingEvents.ts.
import type { EGameState } from 'shared/enum/common';
import type { EGamePhase } from 'shared/enum/phase';
import type INotificationAction from 'shared/interfaces/notification';
import type { IGameLogEntry } from 'shared/interfaces/gameLog';
import type Player from 'client/models/Player';

export type IPlayersMap = { [key: string]: Player | null };

// Состояние партии, как его видит этот игрок. Тайного здесь нет: голоса приходят
// только вскрытыми, карты миссии — только числом провалов в каждой (см. formatRound).
export interface IRoundPayload {
	phase: EGamePhase;
	missionIndex: number;
	missionResults: (boolean | null)[];
	leaderId: string;
	rejectCount: number;
	maxRejects: number;
	team: string[];
	teamSize: number;
	/** Размер команды каждой из пяти миссий — по правилам, а не по факту набора. */
	missionTeamSizes: number[];
	failsNeeded: number;
	/** Кто уже ответил в текущей фазе — без содержания ответа. */
	answeredIds: string[];
	revealedVotes: Record<string, boolean> | null;
	/** Сколько провалов вскрыла каждая миссия; null — ещё не сыграна. */
	missionFails: (number | null)[];
	/** Кого Убийца взял на прицел, но ещё не выстрелил. Видит это весь стол. */
	assassinAimId: string | null;
	/** В кого выстрелил Убийца; null — выстрела ещё не было (FR-15). */
	assassinTargetId: string | null;
	isRolesRevealed: boolean;
}

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
	/** Играем ли с Мерлином и Убийцей — настройка партии, ставится в лобби. */
	withMerlin: boolean;
	/** И с Персивалем с Морганой — вложенная в предыдущую (FR-16). */
	withPercival: boolean;
	round: IRoundPayload;
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
	playerIds: string[];
}
