import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';

export const seductionAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	player.changeTurnState(ETurnState.inCardActionProgress);
	const allPlayersExeptCurrent = player.getAllPlayablePlayersExceptCurrent();
	game.turnContext = {
		type: ETurnContextType.seduction,
		offensePlayer: player,
		defensePlayer: null,
		cardUniqueId: card.uniqueId,
	};
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: allPlayersExeptCurrent,
		text: 'Выбри с кем хочешь поменяться картами'
      },
    }));
    game.addLog(`Игрок ${player.nickname} играет Соблазн`);
};

export const seductionSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (!game.turnContext) return
	switch (game.turnContext.type) {
		case ETurnContextType.seduction:
		case ETurnContextType.friendshipSeduction:
			if (game.turnContext.type === ETurnContextType.seduction) {
				player.discardCard(game.turnContext.cardUniqueId);
			}
			const playerToTrade = game.players[selectedPlayerId];
			if (player === playerToTrade) {
				game.turnContext = null;
				game.endTurn(player.id);
				return;
			}
			game.turnContext = {
				type: ETurnContextType.trade,
				offensePlayer: player,
				defensePlayer: playerToTrade,
				offenseCard: null,
				defenseCard: null,
			};
		    game.addLog(`Игрок ${player.nickname} предлагает обмен картами ${playerToTrade.nickname}`);
			//playerToTrade.changeTurnState(ETurnState.inDefenseTrade);
			player.changeTurnState(ETurnState.inOffenseTrade)
	}


};
