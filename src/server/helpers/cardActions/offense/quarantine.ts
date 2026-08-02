import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';

import {getCard} from 'shared/constant/cards';
import {EEventID} from 'shared/enum/cards';
import {formatCards} from 'server/helpers/cardHelpers';
import {EGameLogType} from 'shared/enum/gameLogType';

export const quarantineAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	if (!card.uniqueId) return;
	game.turnContext = {
		type: ETurnContextType.quarantinePersonSelect,
		playerId: player.id,
		cardUniqueId: card.uniqueId,
	};

	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: [...player.getPlayabeNeighbours(), player.id],
		text: 'Выбри на кого хочешь применить карантин'
      },
    }));
};

export const quarantineSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.quarantinePersonSelect) {
		throw new Error('Выбор quarantine произошел без контекста quarantinePersonSelect');
	}
	player.discardCard(game.turnContext.cardUniqueId);
	const selectedPlayer = game.players[selectedPlayerId];
	if (!selectedPlayer) return;
	selectedPlayer.quarantine = 3;
	// Don't let the counter tick on the turn-start that immediately follows
	// applying the quarantine (e.g. when the next player gets quarantined).
	selectedPlayer.quarantineFresh = true;
	game.turnContext = null;
	game.notifyAllPlayers(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
		text: `Игрок ${selectedPlayer.nickname} теперь на карантине`,
		cards: formatCards([getCard(EEventID.quarantine)])
      },
    }));
	game.addLog(`Игрок ${selectedPlayer.nickname} теперь на карантине`, EGameLogType.quarantine);
	game.addCardEffect({cardId: EEventID.quarantine, player, target: selectedPlayer});
	player.changeTurnState(ETurnState.inOffenseTrade)
	//player.changeTurnState(ETurnState.idle);
	//const nextPlayer = player.getNextAlivePlayer();
	//game.endTurn(player.id)
	//game.changeTurn(nextPlayer.id)
};
