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

export const menyaemsyaMestamiAct = ({card, game, player} : {card:ICard, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.menyaemsyaMestamiPersonSelect,
		playerId: player.id,
	};
	discardCard({game, player, cardUniqueId: card.uniqueId});
	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.playerSelect,
		playersToSelect: player.getPlayabeNeighbours(),
		text: 'Выбери с кем хочешь поменяться местами'
      },
    }));
};

export const menyaemsyaMestamiSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (game.turnContext.type !== ETurnContextType.menyaemsyaMestamiPersonSelect) {
		throw new Error('Смена места произошла без контекста menyaemsyaMestamiPersonSelect');
	}
	game.turnContext = null;
	const playerToSwap = game.players[selectedPlayerId];
	game.swapPlayers(player.id, selectedPlayerId);
	game.addLog(`Игрок ${player.nickname} играет карту "Меняемся местами" на  ${playerToSwap.nickname}`);
	player.changeTurnState(ETurnState.inOffenseTrade)
};
