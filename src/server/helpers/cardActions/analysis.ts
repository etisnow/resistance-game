import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotification} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICard} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {discardCard} from 'server/helpers/discardCard';

export const analysisAct = ({card, game, player} : {card:ICard, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.analysisPersonSelect,
		playerId: player.id,
	};
	discardCard({game, player, cardUniqueId: card.uniqueId});
	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.playerSelect,
		playersToSelect: player.getPlayabeNeighbours(),
		text: 'Выбери кого хочешь проанализировать'
      },
    }));
};

export const analysisSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (game.turnContext.type !== ETurnContextType.analysisPersonSelect) {
		throw new Error('Карта сыграна без контекста analysisPersonSelect');
	}
	game.turnContext = null;
	const selectedPlayer = game.players[selectedPlayerId];


	game.addLog(`Игрок ${player.nickname} анализирует ${selectedPlayer.nickname}`);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.okayCard,
        cards: selectedPlayer.hand as ICard[],
		text: `${selectedPlayer.nickname}: На, смотри!`,
      },
    }));
	player.changeTurnState(ETurnState.inOffenseTrade)
};
