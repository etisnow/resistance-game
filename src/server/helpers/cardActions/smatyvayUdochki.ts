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

export const smatyvayUdochkiAct = ({card, game, player} : {card:ICard, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.smatyvayUdochkiPersonSelect,
		playerId: player.id,
	};
	discardCard({game, player, cardUniqueId: card.uniqueId});
	player.changeTurnState(ETurnState.inCardActionProgress);
	const allPlayersExeptCurrent = game.playersList.filter(pId => pId !== player.id && player.quarantine === 0);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.playerSelect,
		playersToSelect: allPlayersExeptCurrent,
		text: 'Выбри с кем хочешь поменяться местами'
      },
    }));
};

export const smatyvayUdochkiSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (game.turnContext.type !== ETurnContextType.smatyvayUdochkiPersonSelect) {
		throw new Error('Смена места произошла без контекста smatyvayUdochkiPersonSelect');
	}
	game.turnContext = null;
	const playerToSwap = game.players[selectedPlayerId];
	game.swapPlayers(player.id, selectedPlayerId);
	game.addLog(`Игрок ${player.nickname} играет карту "Сматывай удочки" на  ${playerToSwap.nickname}`);
	player.changeTurnState(ETurnState.inOffenseTrade)
};
