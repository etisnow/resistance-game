import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {formatCards} from 'server/helpers/cardHelpers';
import {EEventID} from 'shared/enum/cards';
import {EGameLogType} from 'shared/enum/gameLogType';


export const analysisAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	if (!card.uniqueId) return;
	game.turnContext = {
		type: ETurnContextType.analysisPersonSelect,
		playerId: player.id,
		cardUniqueId: card.uniqueId,
	};
	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: player.getPlayabeNeighbours(),
		text: 'Выбери кого хочешь проанализировать'
      },
    }));
};

export const analysisSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.analysisPersonSelect) {
		throw new Error('Карта сыграна без контекста analysisPersonSelect');
	}
	player.discardCard(game.turnContext.cardUniqueId);
	game.turnContext = null;
	const selectedPlayer = game.players[selectedPlayerId];
	if (!selectedPlayer) return;
	game.addLog(`Игрок ${player.nickname} играет карту Анализ на игрока ${selectedPlayer.nickname}`, EGameLogType.card)

	game.addLog(`Игрок ${player.nickname} анализирует ${selectedPlayer.nickname}`, EGameLogType.card);
	game.addCardEffect({cardId: EEventID.analysis, player, target: selectedPlayer});
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
        cards: formatCards(selectedPlayer.hand),
		text: `${selectedPlayer.nickname}: На, смотри!`,
      },
    }));
	player.changeTurnState(ETurnState.inOffenseTrade)
};
