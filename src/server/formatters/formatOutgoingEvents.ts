import {EServerEventType} from 'shared/enum/enumServerEvents';
import {Player} from 'server/models/Player';
import {Game} from 'server/models/Game';
import {find, map, mapValues} from 'lodash';
import {GameServer} from 'server/server/GameServer';
import INotification from 'shared/interfaces/notification';
import {formatHand} from 'server/formatters/formatHand';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ITurnContextTrade} from 'shared/interfaces/turnContext';
import {IFormatTradeContext} from 'shared/interfaces/common';

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
	return formatEvent(EServerEventType.updateGame, formatUpdatePlayerPayload({ game, viewer }))
};

export const formatPlayerConnectedEvent = ({ game, viewer }: {game: Game, viewer: Player}) => {
	return formatEvent(EServerEventType.playerConnected, formatUpdatePlayerPayload({ game, viewer }))
};

const formatTradeContext = (game: Game) : IFormatTradeContext => {
	const tradeContext = game.turnContext;
	if (!tradeContext || tradeContext.type !== ETurnContextType.trade) return;
	return {
		offensePlayerId: tradeContext.offensePlayer ? tradeContext.offensePlayer.id : null,
		defensePlayerId: tradeContext.defensePlayer ? tradeContext.defensePlayer.id : null,
		isCardPicked: !!tradeContext.offenseCardId
	}
}

const formatUpdatePlayerPayload = ({ game, viewer }: {game: Game, viewer: Player}) => {
	return {
		players: formatPlayers(game, viewer),
		turnPlayerId:  game.turnPlayerId,
		playersList:  game.playersList,
		isClockwise:  game.isClockwise,
		gameLog: game.gameLog,
		tradeContext: formatTradeContext(game),
		deck: formatDeck(game)
	}
};



const formatPlayer = (game: Game, viewer: Player) => (player: Player) => {
	if (!player) return null;
	const isViewer = viewer.id === player.id;
	const isViewerThing = viewer.isThing;
	const isViewerInjured = viewer.isThing;

	return {
		id: player.id,
		nickname: player.nickname,
		state: player.state,
		isHost: player.isHost,
		isYou: player === viewer,
		hand: isViewer ? formatHand(game, player) : null,
		color: player.color,
		turnState: player.turnState,
		//isInjured: true,
		isInjured: player.isThing ? null : (isViewerThing || isViewer ? player.isInjured : null),
		//isThing: true,
		isThing: isViewerThing || isViewerInjured ? player.isThing : null,
		quarantine: player.quarantine,
	}
};

const formatPlayers = (game: Game, viewer: Player) => {
	return mapValues(game.players, formatPlayer(game, viewer))
};

export const formatPlayerConnectionSuccessEvent = ({player, game, players}: {player: Player, game: Game, players: { [key:string]: Player } }) => {
	return formatEvent(EServerEventType.gameConnectionSuccess, {
		game: {
			id: game.id
		},
		player: formatPlayer(game, player)(player),
		players: formatPlayers(game, player),
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
