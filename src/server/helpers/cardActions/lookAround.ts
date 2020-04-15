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
import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';

export const lookAroundAct = ({card, game, player} : {card:ICard, game: Game, player: Player}) => {
	discardCard({game, player, cardUniqueId: card.uniqueId});
	game.isClockwise = !game.isClockwise;
	player.changeTurnState(ETurnState.inCardActionProgress);
    game.notifyAllPlayers(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.okayCard,
		cards: [getCard(EEventID.look_around)],
		text: `${player.nickname} изменил направление хода`
      },
    }));
    player.changeTurnState(ETurnState.inOffenseTrade)
};
