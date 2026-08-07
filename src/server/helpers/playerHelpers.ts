import {Player} from 'server/models/Player';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {debugLog} from 'server/helpers/util';
import {EGameLogType} from 'shared/enum/gameLogType';
import {EAnalyticsDeathCause} from 'shared/analytics/contract';

const processDeathByOverinfection = (player:Player) => {
	const game = player.game;
	const nextPlayer = player.getNextAlivePlayer();
	game.addLog(`Какое несчастье. ${player.nickname} умер от перезаражения. Вместо него теперь играет ${nextPlayer.nickname}`, EGameLogType.death)
	game.killPlayer(player, {cause: EAnalyticsDeathCause.overinfect});
	debugLog(`Состояние игры ${game.turnContext && game.turnContext.type}. Стейт некста ${nextPlayer.turnState}`)
	if (game.turnContext && game.turnContext.type === ETurnContextType.trade) {
		if (game.turnContext.defensePlayer === player) {
			game.turnContext.offensePlayer.interruptTrade();
		} else if (game.turnContext.offensePlayer === player) {
			game.turnContext = null;
			game.changeTurn(nextPlayer.id)

		}
		return;
	}
	if (!game.turnContext) {
		game.changeTurn(nextPlayer.id)
	}
}

const processOffenseTrade = (player: Player) => {
	const context = player.game.turnContext;
	let playerToTrade: Player | null =  null;
	if (context && context.type === ETurnContextType.trade && context.defensePlayer) {
		playerToTrade = context.defensePlayer
	} else {
		playerToTrade = player.getNextPlayer();
		debugLog('PLAYER',player.nickname, 'PLAYER TO TRADE', playerToTrade.nickname, player.game.turnContext && player.game.turnContext.type);
	}


    if (playerToTrade.state === EPlayerState.door && !player.game.turnContext) {
		player.game.addLog(`Игрок ${player.nickname} не меняется из-за заколоченной двери`, EGameLogType.trade);
		player.game.endTurn(player.id);
		return
    }
    if ((player.quarantine > 0 || playerToTrade.quarantine > 0) && !player.game.turnContext) {
		player.game.addLog(`Игрок ${player.nickname} не меняется из-за карантина`, EGameLogType.quarantine);
		player.game.endTurn(player.id);
		return
    }
    if (playerToTrade === player) {
		player.game.addLog(`Игрок не может поменяться сам с собой`, EGameLogType.trade);
		player.game.endTurn(player.id);
		return
    }

    if (!player.game.turnContext) {
	    player.game.turnContext = {
	      type: ETurnContextType.trade,
	      defensePlayer: playerToTrade,
	      offensePlayer: player,
	      offenseCard: null,
	      defenseCard: null,
	    };
    }
    return;
}

const processDefenseTrade = (player:Player) => {
	const game = player.game;

	if (!game.turnContext || game.turnContext.type !== ETurnContextType.trade) {
		throw new Error(`Игрок ${player.nickname} получил inDefenseTrade вне контекста торговли`)
		return;
	}

	if (game.turnContext.offensePlayer === player) {
		game.addLog(`Игрок ${player.nickname} не может меняться картой сам с собой. Торговля отменяется.`, EGameLogType.trade)
		return player.interruptTrade();
	}
	if (player.quarantine > 0) {
		game.addLog(`Игрок ${player.nickname} не может меняться картой, т.к он на карантине. Торговля отменяется.`, EGameLogType.quarantine)
		return game.turnContext.offensePlayer.interruptTrade();
	}

	game.turnContext.defensePlayer = player;


}

export const processTurnContext = ({player, turnState}: {player:Player, turnState: ETurnState}) => {
	if (!player.isAlive()) return;

	if (player.isOverInfected() && (turnState === ETurnState.inOffenseTrade || turnState === ETurnState.inDefenseTrade)) {
		return processDeathByOverinfection(player);
	}
	switch (turnState) {
		case ETurnState.inOffenseTrade: {
			return processOffenseTrade(player);
		}
		case ETurnState.inDefenseTrade: {
			return processDefenseTrade(player);
		}
	}
};
