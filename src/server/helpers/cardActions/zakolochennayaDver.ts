import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotification} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {uniqueId, each} from 'lodash';
import {ICard} from 'shared/interfaces/cards';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ITurnContextYporstvoCardSelect} from 'shared/interfaces/turnContext';
import {discardCard} from 'server/helpers/discardCard';

export const zakolochennayaDverAct = ({card, game, player} : {card:ICard, game: Game, player: Player}) => {
	game.turnContext = {
		type: ETurnContextType.zakolochennayaDverPersonSelect,
		playerId: player.id,
	};
	discardCard({game, player, cardUniqueId: card.uniqueId});
	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.playerSelect,
		playersToSelect: player.getPlayabeNeighbours(),
		text: 'Выбери между кем ты хочешь поставить дверь'
      },
    }));
};

export const zakolochennayaDverSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (game.turnContext.type !== ETurnContextType.zakolochennayaDverPersonSelect) {
		throw new Error('Смена места произошла без контекста zakolochennayaDverPersonSelect');
	}
	game.turnContext = null;
	const doorPlayer = new Player({socket: null, playerState: EPlayerState.door});
	doorPlayer.id = uniqueId('dver_');
	doorPlayer.nickname = 'Дверь';
	game.players[doorPlayer.id]= doorPlayer;



	const currentPlayerIndex = game.playersList.indexOf(player.id);
	const selectedPlayerIndex = game.playersList.indexOf(selectedPlayerId);
	const lastIndex = game.playersList.length - 1;

	//Если игрок первый или последний, а его цель наборот - просто аншифтим дверь в массив
	if ((currentPlayerIndex === lastIndex && selectedPlayerIndex === 0) || (currentPlayerIndex === 0 && selectedPlayerIndex === lastIndex)) {
		game.playersList.unshift(doorPlayer.id);
	} else {
		if (currentPlayerIndex > selectedPlayerIndex) {
			game.playersList.splice(currentPlayerIndex, 0, doorPlayer.id);
		} else {
			game.playersList.splice(selectedPlayerIndex, 0, doorPlayer.id);
		}
	}




	const selectedPlayer = game.players[selectedPlayerId];
	game.addLog(`Игрок ${player.nickname} играет карту "Заколоченная дверь" на  ${selectedPlayer.nickname}`);
	player.changeTurnState(ETurnState.inOffenseTrade)
};
