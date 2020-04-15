import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotification} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {each} from 'lodash';
import {ICard} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {discardCard} from 'server/helpers/discardCard';
import {ITurnContext} from 'shared/interfaces/turnContext';

export const yporstvoAct = ({card, game, player} : {card:ICard, game: Game, player: Player}) => {
	const first = game.pickCardWithoutPanics();
	const second = game.pickCardWithoutPanics();
	const third = game.pickCardWithoutPanics();

	game.turnContext = {
		type: ETurnContextType.yporstvoCardSelect,
		cards: [first, second, third],
		playerId: player.id,
	};
	player.changeTurnState(ETurnState.inCardActionProgress);
	discardCard({game, player, cardUniqueId: card.uniqueId});
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
        type: ENotification.selectCard,
        cards: [first, second, third],
        text: `Выбери одну их этих карт`,
      },
    }));
};

export const yporstvoSelect = ({game, player, cardUniqueId} : {game: Game, player: Player, cardUniqueId: string}) => {
	if (game.turnContext.type !== ETurnContextType.yporstvoCardSelect) {
		throw new Error('Выбор упорства произошел без контекста yporstvoCardSelect');
	}
	each(game.turnContext.cards, (card) => {
		if (card.uniqueId === cardUniqueId) {
			player.hand.push(card);
		} else {
			game.discardedDeck.push(card);
		}
	});
	game.addLog(`Игрок ${player.nickname} играет карту "Упорство"`);
	game.turnContext = null;
	player.changeTurnState(ETurnState.inCardAction)
};
