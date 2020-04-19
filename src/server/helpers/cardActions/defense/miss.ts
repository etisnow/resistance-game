import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotification} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ICardEvent} from 'shared/interfaces/cards';
import {discardCard} from 'server/helpers/discardCard';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {ETurnState} from 'shared/enum/player';

export const missAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	if (game.turnContext.type !== ETurnContextType.trade) {
		throw  new Error('Fear использован вне контекста торговли')
	}
	const context = game.turnContext;
	discardCard({game, player, cardUniqueId: card.uniqueId});


	const nextPlayer = game.getPlayerByPosition({playerId: player.id, isNext:true});
	game.turnContext.defensePlayer = nextPlayer;
	nextPlayer.changeTurnState(ETurnState.inDefenseTrade);

	game.addLog(`${player.nickname}: используя карту "Мимо" отказывается от обмена с игроком ${context.offensePlayer.nickname}. Вместо него меняется ${nextPlayer.nickname}`);
	game.grabEventCardFromDeck({player});
	player.changeTurnState(ETurnState.idle);



    game.notifyAllPlayersExeptPlayer(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.okayCard,
        cards: [getCard(EEventID.miss)],
		text: `${player.nickname}: отказывается от обмена и теперь ходит игрок ${nextPlayer.nickname}`,
      },
    }), player);
};
