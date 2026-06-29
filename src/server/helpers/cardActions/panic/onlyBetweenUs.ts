import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ETurnState} from 'shared/enum/player';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ENotificationAction} from 'shared/enum/notifications';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {find} from 'lodash';
import {formatCards} from 'server/helpers/cardHelpers';

export const onlyBetweenUsAct = ({game, player}: {game:Game, player:Player}) => {
	player.changeTurnState(ETurnState.inCardActionProgress);
	game.addLog(`Паника: только между нами. Игрок ${player.nickname} показывает карты соседу на выбор`)
	const neighbours = player.getPlayabeNeighbours();
	if (neighbours.length === 0 ) {
		game.addLog('Игрок не показывает никому карты, т.к нет играбельных соседей')
		player.changeTurnState(ETurnState.inOffenseTrade);
		return
	}
	player.notify(formatPlayerNotification({
		player,
		notification: {
			type: ENotificationAction.playerSelect,
			playersToSelect: neighbours,
			text:'Выбери игрока для показа карт'
		}
	}));
	game.turnContext = {
		type: ETurnContextType.onlyBetweenUsPersonSelect,
		playerId: player.id,
	}
};


export const onlyBetweenUsSelect = ({game, selectedPlayerId, player}: {game:Game, player: Player, selectedPlayerId: string}) => {
	const selectedPlayer = find(game.players, {id:selectedPlayerId});
	if (!selectedPlayer) return;
	game.addLog(`Игрок ${player.nickname} показывает свои карты игроку ${selectedPlayer.nickname}`);
    selectedPlayer.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
        cards: formatCards(player.hand),
		text: `${selectedPlayer.nickname}: На, смотри! Чертова паника`,
      },
    }));
	game.turnContext = null;
	player.changeTurnState(ETurnState.inOffenseTrade);
};
