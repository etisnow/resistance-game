import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {each} from 'lodash';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {formatCards} from 'server/helpers/cardHelpers';
import {EGameLogType} from 'shared/enum/gameLogType';


export const tenacityAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	const first = game.pickFirstEventCard();
	const second = game.pickFirstEventCard();
	const third = game.pickFirstEventCard();

	game.turnContext = {
		type: ETurnContextType.tenacityCardSelect,
		cards: [first, second, third],
		playerId: player.id,
	};
	player.changeTurnState(ETurnState.inCardActionProgress);
	if (card.uniqueId) {
		player.discardCard(card.uniqueId);
	}
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
        type: ENotificationAction.selectCards,
        cards: formatCards([first, second, third]),
        count: 1,
        text: `Выбери карту, которую заберёшь себе в руку`,
      },
    }));
};

export const tenacitySelect = ({game, player, cardUniqueIds} : {game: Game, player: Player, cardUniqueIds: string[]}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.tenacityCardSelect) {
		throw new Error('Выбор упорства произошел без контекста tenacityCardSelect');
	}
	const [cardUniqueId] = cardUniqueIds;
	game.addLog(`Игрок ${player.nickname} играет карту "Упорство"`, EGameLogType.card);
	each(game.turnContext.cards, (card) => {
		if (card.uniqueId === cardUniqueId) {
			// Три карты упорства подняты из колоды заранее — со стола выбранная всё
			// равно уходит игроку в руку, и лететь ей неоткуда, кроме как из колоды.
			game.addCardDraw({player});
			player.getCard(card);
		} else {
			game.discardedDeckPush(card);
		}
	});
	game.turnContext = null;
	player.changeTurnState(ETurnState.inCardAction)
};
