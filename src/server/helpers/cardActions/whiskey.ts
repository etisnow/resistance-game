import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotification} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {each} from 'lodash';
import {ICard} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {ITurnContextYporstvoCardSelect} from 'shared/interfaces/turnContext';
import {discardCard} from 'server/helpers/discardCard';

export const whiskeyAct = ({card, game, player} : {card:ICard, game: Game, player: Player}) => {
	discardCard({game, player, cardUniqueId: card.uniqueId});
	player.changeTurnState(ETurnState.inOffenseTrade);
    game.notifyAllPlayers(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.okayCard,
        cards: player.hand as ICard[],
		text: `${player.nickname}: я слишком пьян для этого дерьма! Вот мои карты.`
      },
    }));
};
