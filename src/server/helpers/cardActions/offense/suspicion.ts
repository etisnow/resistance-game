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


export const suspicionAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	if (!card.uniqueId) return;
	game.turnContext = {
		type: ETurnContextType.suspicionPersonSelect,
		playerId: player.id,
		cardUniqueId: card.uniqueId,
	};


	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: player.getPlayabeNeighbours(),
		text: 'Выбри на кого хочешь применить подозрение'
      },
    }));
};

export const suspicionSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.suspicionPersonSelect) {
		throw new Error('Выбор подозрения произошел без контекста suspicionPersonSelect');
	}
	player.discardCard(game.turnContext.cardUniqueId);
	const playerToView= game.players[selectedPlayerId];
	if (!playerToView) return;
	const cardToView = playerToView.getRandomCard();
	game.turnContext = null;
	if (!cardToView) return;
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.okayCard,
		text: `Ты подсмотрел у игрока ${playerToView.nickname} эту карту`,
		cards: formatCards([cardToView])
      },
    }));
	game.addLog(`Игрок ${player.nickname} играет карту "Подозрение" на игрока ${playerToView.nickname}`, EGameLogType.card);
	game.addCardEffect({cardId: EEventID.suspicion, player, target: playerToView});
	player.changeTurnState(ETurnState.inOffenseTrade)
};
