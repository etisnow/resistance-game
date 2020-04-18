import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotification} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {discardCard} from 'server/helpers/discardCard';
import {each} from 'lodash';

export const seductionAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	discardCard({game, player, cardUniqueId: card.uniqueId});
	player.changeTurnState(ETurnState.inCardActionProgress);
	const allPlayersExeptCurrent = game.playersList.filter(pId => pId !== player.id && player.quarantine === 0);
	game.turnContext = {
		type: ETurnContextType.trade,
		offensePlayer: player,
		defensePlayer: null,
		offenseCardId: null,
	};
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.playerSelect,
		playersToSelect: allPlayersExeptCurrent,
		text: 'Выбри с кем хочешь поменяться картами'
      },
    }));
};

export const seductionSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	const playerToTrade = game.players[selectedPlayerId];
	game.turnContext = {
		type: ETurnContextType.trade,
		offensePlayer: player,
		defensePlayer: playerToTrade,
		offenseCardId: null,
	};
	game.addLog(`Игрок ${player.nickname} играет карту "Cоблазн" и предлагает обмен картами ${playerToTrade.nickname}`);
	//playerToTrade.changeTurnState(ETurnState.inDefenseTrade);
	player.changeTurnState(ETurnState.inOffenseTrade)
};

export const seductionTradeFinish = ({game} : {game: Game}) => {
	if (game.turnContext.type !== ETurnContextType.trade) {
		throw new Error('Завершение обмена seduction');
	}
	each(game.players, (player: Player) => {
		player.changeTurnState(ETurnState.idle);
	});
	const nextPlayer = game.getPlayerByPosition({playerId: game.turnContext.offensePlayer.id, isNext: true});
	game.changeTurn(nextPlayer.id);
	game.turnContext = null;
};
