import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {formatCards} from 'server/helpers/cardHelpers';
import {EEventID} from 'shared/enum/cards';
import {EGameLogType} from 'shared/enum/gameLogType';


export const whiskeyAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	if (!card.uniqueId) return;
	player.discardCard(card.uniqueId);
	player.changeTurnState(ETurnState.inOffenseTrade);
    game.notifyAllPlayers(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
        cards: formatCards(player.hand),
		text: `${player.nickname}: я слишком пьян для этого дерьма! Вот мои карты.`
      },
    }));
    game.addLog(`${player.nickname}: я слишком пьян для этого дерьма! Вот мои карты.`, EGameLogType.card);
    game.addCardEffect({cardId: EEventID.whiskey, player});
};
