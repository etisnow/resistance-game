import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotification} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {each} from 'lodash';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {discardCard} from 'server/helpers/discardCard';
import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';

export const flamethrowerAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.flamethrowerSelect,
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

export const flamethrowerSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (game.turnContext.type !== ETurnContextType.flamethrowerSelect) {
		throw new Error('Выбор огнемета произошел без контекста flamethrowerSelect');
	}
	const selectedPlayer = game.players[selectedPlayerId];
	game.turnContext = null;
	game.notifyAllPlayers(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.okayCard,
		cards: [getCard(EEventID.flamethrower)],
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
