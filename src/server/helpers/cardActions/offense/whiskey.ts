import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {formatCards} from 'server/helpers/cardHelpers';
import {EEventID} from 'shared/enum/cards';
import {EGameLogType} from 'shared/enum/gameLogType';
import {cardLogName} from 'shared/constant/cardNames';
import {map} from 'lodash';


export const whiskeyAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	if (!card.uniqueId) return;
	player.discardCard(card.uniqueId);
	// Виски показывает руку всем, поэтому карты идут в лог поимённо: окошко
	// закроется, а по логу видно, что именно у игрока было (и что не было).
	const shownCards = map(player.hand, (handCard) => cardLogName(handCard.id)).join(', ');
	player.changeTurnState(ETurnState.inOffenseTrade);
    game.notifyAllPlayers(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
        cards: formatCards(player.hand),
		text: `${player.nickname}: я слишком пьян для этого дерьма! Вот мои карты.`
      },
    }));
    game.addLog(
		`${player.nickname} играет ${cardLogName(EEventID.whiskey)}: я слишком пьян для этого дерьма!`
			+ ` Вот мои карты: ${shownCards || 'а карт-то и нет'}`,
		EGameLogType.card,
	);
    game.addCardEffect({cardId: EEventID.whiskey, player});
};
