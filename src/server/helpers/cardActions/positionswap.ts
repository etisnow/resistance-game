import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotification} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {discardCard} from 'server/helpers/discardCard';

export const positionswapAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.positionswap,
		offensePlayer: player,
		defensePlayer: null,
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

export const positionswapSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (game.turnContext.type !== ETurnContextType.positionswap) {
		throw new Error('Смена места произошла без контекста positionswap');
	}
	const defensePlayer = game.players[selectedPlayerId];
	game.turnContext = {
		type: ETurnContextType.positionswap,
		offensePlayer: player,
		defensePlayer: defensePlayer,
	};
    player.notify(formatPlayerNotification({
		player: player,
		notification: {
			type: ENotification.playerSelect,
			playersToSelect: player.getPlayabeNeighbours(),
			text: 'Выбери с кем хочешь поменяться местами'
		},
    }));
    defensePlayer.notify(formatPlayerNotification({
		player: player,
		notification: {
			type: ENotification.swapDesicion,
			text: ''
		},
    }));
	//game.swapPlayers(player.id, selectedPlayerId);
	game.addLog(`Игрок ${player.nickname} предложил смену мест  ${defensePlayer.nickname}`);
	player.changeTurnState(ETurnState.inOffenseTrade)
};
