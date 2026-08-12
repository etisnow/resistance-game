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
import {EEventID} from 'shared/enum/cards';


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
	// Событие применения — как у прочих карт: до него «Упорство» отыгрывалось
	// молча и невидимо, стол знал о нём только из лога. По этому событию карта
	// всплывает над кружком игрока и звучит затвор. Цели у карты нет: игрок
	// упорствует сам с собой.
	//
	// Здесь, а не в tenacitySelect: карту разыгрывают сейчас — она уже ушла из
	// руки, и стол должен увидеть и услышать это сразу. Выбор одной из трёх — дело
	// самого игрока и остальных не касается; к моменту выбора звук опоздал бы ровно
	// на то время, что игрок разглядывает карты.
	game.addCardEffect({cardId: EEventID.tenacity, player});
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
