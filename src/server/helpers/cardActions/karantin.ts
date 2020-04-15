import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotification} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICard} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {discardCard} from 'server/helpers/discardCard';
import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';

export const karantinAct = ({card, game, player} : {card:ICard, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.karantinPersonSelect,
		playerId: player.id,
	};

	discardCard({game, player, cardUniqueId: card.uniqueId});
	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.playerSelect,
		playersToSelect: [...player.getPlayabeNeighbours(), player.id],
		text: 'Выбри на кого хочешь применить карантин'
      },
    }));
};

export const karantinSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (game.turnContext.type !== ETurnContextType.karantinPersonSelect) {
		throw new Error('Выбор karantin произошел без контекста karantinPersonSelect');
	}
	const selectedPlayer = game.players[selectedPlayerId];
	selectedPlayer.quarantine = 3;
	game.turnContext = null;
	game.notifyAllPlayers(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.okayCard,
		text: `Игрок ${selectedPlayer.nickname} теперь на карантине`,
		cards: [getCard(EEventID.karantin)]
      },
    }));
	game.addLog(`Игрок ${selectedPlayer.nickname} теперь на карантине`);
	player.changeTurnState(ETurnState.idle);
	const nextPlayer = game.getPlayerByPosition({playerId:player.id, isNext:true});
	game.changeTurn(nextPlayer.id)
};
