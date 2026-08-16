import {EServerEventType} from 'shared/enum/enumServerEvents';
import {Player} from 'server/models/Player';
import {Game} from 'server/models/Game';
import {find, map, mapValues, filter, range} from 'lodash';
import {GameServer} from 'server/server/GameServer';
import INotificationAction from 'shared/interfaces/notification';
import {EPlayerState} from 'shared/enum/player';
import {EGameState} from 'shared/enum/common';
import {EGamePhase} from 'shared/enum/phase';
import {keys} from 'lodash';
import {failsNeeded, isPlayableCount, MAX_REJECTS, MISSIONS_COUNT, teamSize} from 'shared/constant/resistance';

function formatEvent(type: string, payload?: unknown) {
	return {
		type, payload
	}
}

export const formatStartGameEvent = (_args: {players: { [key: string]: Player }}) => {
	return formatEvent(EServerEventType.gameStarted, {})
};

export const formatUpdateGameEvent = ({ game, viewer }: {game: Game, viewer: Player}) => {
	return formatEvent(EServerEventType.updateGame, formatUpdatePlayerPayload({ game, viewer }))
};

const formatUpdatePlayerPayload = ({ game, viewer }: {game: Game, viewer: Player}) => {
	return {
		hostPlayerId: game.hostPlayerId,
		state: game.state,
		currentPlayer: formatPlayer(game, viewer)(viewer),
		players: formatPlayers(game, viewer),
		turnPlayerId: game.turnPlayerId,
		playersList: game.playersList,
		isClockwise: game.isClockwise,
		gameLog: game.gameLog,
		currentAction: viewer.currentAction,
		round: formatRound(game),
	}
};

/**
 * Состояние партии для стола. Тайное сюда не попадает: пока голосуют, наружу
 * уходит только «кто уже ответил» (FR-5), а карты миссии — только числом
 * провалов в каждой сыгранной (FR-9).
 */
const formatRound = (game: Game) => {
	const round = game.round;
	const playersCount = game.seatedPlayers().length;
	const isPlayable = isPlayableCount(playersCount);
	return {
		phase: round.phase,
		missionIndex: round.missionIndex,
		missionResults: round.missionResults,
		leaderId: round.leaderId,
		rejectCount: round.rejectCount,
		maxRejects: MAX_REJECTS,
		team: round.team,
		// Сколько человек нужно этой миссии и сколько провалов её сорвёт: считать
		// это на клиенте значило бы держать вторую копию таблиц правил.
		teamSize: isPlayable ? teamSize(playersCount, Math.min(round.missionIndex, MISSIONS_COUNT - 1)) : 0,
		// Сколько человек идёт на каждую миссию: трек рисует их точками у сыгранных.
		// Считает сервер по тем же таблицам, что и всё остальное, — вторая их копия
		// на клиенте рано или поздно разошлась бы с правилами.
		missionTeamSizes: isPlayable
			? map(range(MISSIONS_COUNT), (index) => teamSize(playersCount, index))
			: [],
		failsNeeded: isPlayable ? failsNeeded(round.missionIndex, playersCount) : 1,
		// Кто уже ответил в текущей фазе — без содержания ответа.
		answeredIds: round.phase === EGamePhase.voting
			? keys(round.votes)
			: round.phase === EGamePhase.mission ? keys(round.missionCards) : [],
		revealedVotes: round.revealedVotes,
		missionFails: round.missionFails,
		isRolesRevealed: round.isRolesRevealed,
	};
};

// Что один игрок знает о другом.
const formatPlayer = (game: Game, viewer: Player) => (player: Player) => {
	if (!player) return null;
	// Шпионы знают друг друга, сопротивление не знает никого (FR-2). На развязке
	// роли открываются всем (FR-10). null — «не твоё дело», и это не то же самое,
	// что false: по «точно не шпион» игра читалась бы с первого обновления.
	const isRoleVisible = game.round.isRolesRevealed || viewer.isSpy || player === viewer;

	return {
		id: player.id,
		nickname: player.nickname,
		state: player.state,
		isHost: game.hostPlayerId === player.id,
		isYou: player === viewer,
		color: player.color,
		avatar: player.avatar,
		turnState: player.turnState,
		isReady: player.isReady,
		isConnected: player.isConnected,
		isSpy: isRoleVisible ? player.isSpy : null,
		// Метки — личные заметки смотрящего, чужие ему не показываем.
		marks: player === viewer ? player.marks : null,
	}
};

const formatPlayers = (game: Game, viewer: Player) => {
	return mapValues(game.players, formatPlayer(game, viewer))
};

const getGameHost = (game: Game) => {
	return find(game.players, player => { return player.id === game.hostPlayerId });
}

export const formatLobbyState = (gameServer: GameServer) => {
	const filteredGames = filter(gameServer.games, {gameInProcess: true})
	return formatEvent(EServerEventType.lobbyUpdate, {
		games: map(filteredGames, (game: Game) => {
			const hostPlayer = getGameHost(game);
			return {
				gameId: game.id,
				hostName: hostPlayer ? hostPlayer.nickname : 'ERROR',
				// Двери — служебные «игроки» стола, в счётчик комнаты они не идут.
				playersCount: filter(game.players, (player: Player) => player.state !== EPlayerState.door).length,
				isStarted: game.state === EGameState.sarted,
			}
		})
	})
};

export const formatPlayerNotification = ({notification} : {player: Player, notification: INotificationAction}) => {
	return formatEvent(EServerEventType.notification, notification)
}

export const formatCommonError = (errorMessage: string) => {
	return formatEvent(EServerEventType.commonError, {
		error: errorMessage,
	})
};

export const formatSoundNotification = () => {
	return formatEvent(EServerEventType.soundNotification, {
	})
};

// Кого стол ждёт. Список, а не один игрок: в «Сопротивлении» голосуют все разом,
// и таймер должен показывать всю фазу, а не последнего спрошенного.
export const formatTimerNotification = (timerPayload: { text: string; seconds: number; playerIds: string[] }) => {
	return formatEvent(EServerEventType.timerNotification, timerPayload)
};
