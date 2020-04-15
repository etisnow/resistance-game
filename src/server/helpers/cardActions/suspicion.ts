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

export const suspicionAct = ({card, game, player} : {card:ICard, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.suspicionPersonSelect,
		playerId: player.id,
	};

	discardCard({game, player, cardUniqueId: card.uniqueId});
	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.playerSelect,
		playersToSelect: player.getPlayabeNeighbours(),
		text: 'Выбри на кого хочешь применить подозрение'
      },
    }));
};

export const suspicionSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (game.turnContext.type !== ETurnContextType.suspicionPersonSelect) {
		throw new Error('Выбор подозрения произошел без контекста suspicionPersonSelect');
	}
	const playerToView= game.players[selectedPlayerId];
	const cardToView = playerToView.getRandomCard();
	game.turnContext = null;
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.okayCard,
		text: `Ты подсмотрел у игрока ${playerToView.nickname} эту карту`,
		cards: [cardToView]
      },
    }));
	game.addLog(`Игрок ${player.nickname} играет карту "Подозрение"`);
	player.changeTurnState(ETurnState.inOffenseTrade)
};
