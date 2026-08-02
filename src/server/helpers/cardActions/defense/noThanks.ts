import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ICardEvent} from 'shared/interfaces/cards';

import {ETurnContextType} from 'shared/enum/turnContextType';
import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {formatCards} from 'server/helpers/cardHelpers';
import {EGameLogType} from 'shared/enum/gameLogType';

export const noThanksAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	const context = game.turnContext;
	if (!context || context.type !== ETurnContextType.trade) {
		throw  new Error('Fear использован вне контекста торговли')
	}
	if (!card.uniqueId) return;
	player.discardCard(card.uniqueId);
	game.addLog(`${player.nickname}: используя карту "Нет уж спасибо" отказывается от обмена с игроком ${context.offensePlayer.nickname}`, EGameLogType.defense);
	game.addCardEffect({cardId: EEventID.noThanks, player, target: context.offensePlayer});
	game.grabEventCardFromDeck({player});
    game.notifyAllPlayersExeptPlayer(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
        cards: formatCards([getCard(EEventID.noThanks)]),
		text: `${player.nickname}: отказывается от обмена`,
      },
    }), player);
	const offensePlayer = context.offensePlayer;
	offensePlayer.interruptTrade();
};
