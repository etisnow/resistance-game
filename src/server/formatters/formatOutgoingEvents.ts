import {EServerEventType} from 'shared/enum/enumServerEvents';
import {Player} from 'server/models/Player';
import {Game} from 'server/models/Game';
import {find, map, mapValues, filter} from 'lodash';
import {GameServer} from 'server/server/GameServer';
import INotificationAction from 'shared/interfaces/notification';
import {EPlayerState} from 'shared/enum/player';
import {EGameState} from 'shared/enum/common';

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
	}
};

// Что один игрок знает о другом. Роли сюда ещё не попадают: их раздача и правила
// видимости — фаза 1 (см. docs/PLAN.md).
const formatPlayer = (game: Game, viewer: Player) => (player: Player) => {
	if (!player) return null;

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

export const formatTimerNotification = (timerPayload: { text: string; seconds: number; playerId: string }) => {
	return formatEvent(EServerEventType.timerNotification, timerPayload)
};
