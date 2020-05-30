import {EServerEventType} from 'shared/enum/enumServerEvents';
import {Player} from 'server/models/Player';
import {Game} from 'server/models/Game';
import {find, map, mapValues, reduce} from 'lodash';
import {GameServer} from 'server/server/GameServer';
import INotificationAction from 'shared/interfaces/notification';
import {formatHand} from 'server/formatters/formatHand';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {IFormatTradeContext} from 'shared/interfaces/common';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {getNextChainReactionPlayer} from 'server/helpers/cardActions/panic/chainReaction';
import {getCardActions} from 'server/formatters/formatCardActions';
import {isPlayerCanCancel} from 'server/helpers/validators';

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

/*export const formatPlayerConnectedEvent = ({ game, viewer }: {game: Game, viewer: Player}) => {
	return formatEvent(EServerEventType.playerConnected, formatUpdatePlayerPayload({ game, viewer }))
};*/

const formatTradeContext = (game: Game) : IFormatTradeContext[] => {
	if (!game.turnContext) return;
	const ctx: any = game.turnContext;
	switch (game.turnContext.type) {
		case ETurnContextType.chainReaction:
			return reduce(game.playersList, (acc, pId) => {
				const player = game.players[pId];
				if (player.turnState === ETurnState.inOffenseTrade && player.state !== EPlayerState.door) {
					const defensePlayer = getNextChainReactionPlayer({currentPlayer: player, game})
					acc.push({
						offensePlayerId: pId,
						defensePlayerId: defensePlayer.id,
						isCardPicked: false,
						type: game.turnContext.type,
					})
				}
				return acc;
			}, []);
		case ETurnContextType.trade:
			return [{
				offensePlayerId: ctx.offensePlayer ? ctx.offensePlayer.id : null,
				defensePlayerId: ctx.defensePlayer ? ctx.defensePlayer.id : null,
				isCardPicked: !!ctx.offenseCardId,
				type: game.turnContext.type,
			}];
		case ETurnContextType.burn:
		case ETurnContextType.positionswap:
			return [{
				offensePlayerId: ctx.offensePlayer ? ctx.offensePlayer.id : null,
				defensePlayerId: ctx.defensePlayer ? ctx.defensePlayer.id : null,
				type: game.turnContext.type,
			}]
	}
}

const getPlayerHand = (game: Game, viewer:Player) => {
	return formatHand(game, viewer);
}
const getPlayerHandActions = (game: Game, viewer:Player) => {
	const hand = getPlayerHand(game, viewer);
	return reduce(hand, (acc, card) => {
		acc[card.uniqueId] = getCardActions(game, viewer, card);
		return acc
	}, {})

}
const formatUpdatePlayerPayload = ({ game, viewer }: {game: Game, viewer: Player}) => {
	return {
		hostPlayerId: game.hostPlayerId,
		state: game.state,
		currentPlayer: formatPlayer(game, viewer)(viewer),
		players: formatPlayers(game, viewer),
		hand: getPlayerHand(game, viewer),
		handActions: getPlayerHandActions(game, viewer),
		turnPlayerId:  game.turnPlayerId,
		playersList:  game.playersList,
		isClockwise:  game.isClockwise,
		gameLog: game.gameLog,
		tradeContext: formatTradeContext(game),
		deck: formatDeck(game),
		currentAction: viewer.currentAction,
		isPlayerCanCancel: isPlayerCanCancel(game, viewer),
	}
};



const formatPlayer = (game: Game, viewer: Player) => (player: Player) => {
	if (!player) return null;
	const isViewer = viewer.id === player.id;
	const isViewerThing = viewer.isThing;
	const isViewerInfected = viewer.isThing;

	return {
		id: player.id,
		nickname: player.nickname,
		state: player.state,
		isHost: game.hostPlayerId === player.id,
		isYou: player === viewer,
		color: player.color,
		turnState: player.turnState,
		//isInfected: true,
		isInfected: player.isThing ? null : (isViewerThing || isViewer ? player.isInfected : null),
		//isThing: true,
		isThing: isViewerThing || isViewerInfected ? player.isThing : null,
		quarantine: player.quarantine,
		isReady: player.isReady,
		isConnected: player.isConnected,
	}
};

const formatPlayers = (game: Game, viewer: Player) => {
	return mapValues(game.players, formatPlayer(game, viewer))
};

/*export const formatPlayerConnectionSuccessEvent = ({player, game, players}: {player: Player, game: Game, players: { [key:string]: Player } }) => {
	return formatEvent(EServerEventType.updateGame, formatUpdatePlayerPayload({ game, viewer:player }))
	return formatEvent(EServerEventType.gameConnectionSuccess, {
		currentPlayer: formatPlayer(game, player)(player),
		state: game.state,
		game: {
			id: game.id
		},
		player: formatPlayer(game, player)(player),
		players: formatPlayers(game, player),
	})
}*/

const getGameHost = (game: Game) => {
	const hostPlayer = find(game.players, player => { return player.id === game.hostPlayerId });
	return hostPlayer
}

export const formatLobbyState = (gameServer: GameServer) => {
	return formatEvent(EServerEventType.lobbyUpdate, {
		games: map(gameServer.games, (game: Game) => {
			const hostPlayer = getGameHost(game);
			return {
				gameId: game.id,
				hostName: hostPlayer ? hostPlayer.nickname : 'ERROR'
			}
		})
	})
};


export const formatPlayerNotification = ({player, notification} : {player: Player, notification: INotificationAction}) => {
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

export const formatTimerNotification = (timerPayload) => {
	return formatEvent(EServerEventType.timerNotification, timerPayload)
};
