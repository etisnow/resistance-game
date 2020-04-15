import {EServerEventType} from 'shared/enum/enumServerEvents';
import {Player} from 'server/models/Player';
import {Game} from 'server/models/Game';
import {mapValues, map, find} from 'lodash';
import {GameServer} from 'server/server/GameServer';
import INotification from 'shared/interfaces/notification';

function formatEvent(type, payload) {
	return {
		type, payload
	}
}
export const formatStartGameEvent = ({ players }: {players: { [key:string]: Player }}) => {
	return formatEvent(EServerEventType.gameStarted, {})
};

const formatDeck = (game:Game) => {
	if (!game.deck) return [];
	return {
		count: game.deck.length,
		topCardType: game.deck[0] ? game.deck[0].type : null
	}
}

export const formatUpdateGameEvent = ({ game, viewer }: {game: Game, viewer: Player}) => {
	const players = game.players;
	return formatEvent(EServerEventType.updateGame, formatUpdatePlayerPayload({ game, viewer }))
};

export const formatPlayerConnectedEvent = ({ game, viewer }: {game: Game, viewer: Player}) => {
	const players = game.players;
	return formatEvent(EServerEventType.playerConnected, formatUpdatePlayerPayload({ game, viewer }))
};

const formatUpdatePlayerPayload = ({ game, viewer }: {game: Game, viewer: Player}) => {
	const players = game.players;
	return {
		players: formatPlayers(players, viewer),
		turnPlayerId:  game.turnPlayerId,
		playersList:  game.playersList,
		isClockwise:  game.isClockwise,
		gameLog: game.gameLog,
		deck: formatDeck(game)
	}
};

const formatPlayer = (viewer: Player) => (player: Player) => {
	if (!player) return null;
	const isViewer = viewer.id === player.id;
	const isViewerThing = viewer.isThing;
	const isViewerInjured = viewer.isThing;
	return {
		id: player.id,
		nickname: player.nickname,
		state: player.state,
		isHost: player.isHost,
		hand: isViewer ? player.hand : null,
		color: player.color,
		turnState: player.turnState,
		isInjured: isViewerThing || isViewer ? player.isInjured : null,
		isThing: isViewerInjured ? player.isThing : null,
		quarantine: player.quarantine,
	}
};

const formatPlayers = (players: { [key:string]: Player }, viewer: Player) => {
	return mapValues(players, formatPlayer(viewer))
};

export const formatPlayerConnectionSuccessEvent = ({player, game, players}: {player: Player, game: Game, players: { [key:string]: Player } }) => {
	return formatEvent(EServerEventType.gameConnectionSuccess, {
		game: {
			id: game.id
		},
		player: formatPlayer(player)(player),
		players: formatPlayers(players, player),
	})
}

const findGameHost = (game: Game) => {
	const hostPlayer = find(game.players, player => { return player.isHost });
	return hostPlayer
}

export const formatLobbyState = (gameServer: GameServer) => {
	return formatEvent(EServerEventType.lobbyUpdate, {
		games: map(gameServer.games, (game: Game) => {
			const hostPlayer = findGameHost(game);
			return {
				gameId: game.id,
				hostName: hostPlayer ? hostPlayer.nickname : 'ERROR'
			}
		})
	})
};

export const formatPlayerNotification = ({player, notification} : {player: Player, notification: INotification}) => {
	return formatEvent(EServerEventType.notification, notification)
}
