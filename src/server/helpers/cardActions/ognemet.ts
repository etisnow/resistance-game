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

export const ognemetAct = ({card, game, player} : {card:ICard, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.ognemetSelect,
		playerId: player.id,
	};

	discardCard({game, player, cardUniqueId: card.uniqueId});
	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.playerSelect,
		playersToSelect: player.getPlayabeNeighbours(),
		text: 'Выбери кого ты хочешь сжечь'
      },
    }));
};

export const ognemetSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (game.turnContext.type !== ETurnContextType.ognemetSelect) {
		throw new Error('Выбор огнемета произошел без контекста ognemetSelect');
	}
	const selectedPlayer = game.players[selectedPlayerId];
	game.turnContext = null;
	game.notifyAllPlayers(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.okayCard,
		cards: [getCard(EEventID.ognemet)],
		text: `Игрок ${selectedPlayer.nickname} был заживо сожжен игроком ${player.nickname} и выбывает из игры`,
      },
    }));
	if (selectedPlayer.isThing) {
		game.notifyAllPlayers(formatPlayerNotification({
	      player: player,
	      notification: {
			type: ENotification.info,
			text: `Игра закончена! Нечто выбывает из игры`,
	      },
	    }))
	}
	game.playersList = game.playersList.filter(pId => pId !== selectedPlayerId);
	player.changeTurnState(ETurnState.inOffenseTrade)
};
