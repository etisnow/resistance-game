import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ETurnState} from 'shared/enum/player';

import {ETurnContextType} from 'shared/enum/turnContextType';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {debugLog} from 'server/helpers/util';
import {EGameLogType} from 'shared/enum/gameLogType';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatCards, getDiscardableCards} from 'server/helpers/cardHelpers';
import INotificationAction from 'shared/interfaces/notification';

// Свидание вслепую меняет одну карту, поэтому и окно у него обычное, на один
// выбор (забывчивость меняет три и просит отметить их галочками разом).
export const notifyPlayerBlindDateCard = ({game, player}: {game:Game, player:Player}) : INotificationAction => ({
	type: ENotificationAction.selectCard,
	cards: formatCards(getDiscardableCards({game, player})),
	text: 'Выбери одну из своих карт, чтобы поменять её на карту из колоды',
});

export const blindDateAct = ({game, player}: {game:Game, player:Player}) => {
	game.addLog(`Паника: свидание вслепую. Игрок ${player.nickname} меняет одну карту с руки на карту из колоды`, EGameLogType.panic);
	player.changeTurnState(ETurnState.inCardActionProgress);
	player.notify(formatPlayerNotification({
		player,
		notification: notifyPlayerBlindDateCard({game, player})
	}));
	game.turnContext = {
		type: ETurnContextType.blindDateCardSelect,
		playerId: player.id,
	}
};


export const blindDateSelect = ({game, cardUniqueId, player}: {game:Game, player: Player, cardUniqueId: string}) => {
	debugLog('BLIND DATE CARD UNIQUE', cardUniqueId);
	player.discardCard(cardUniqueId);
	const first = game.pickFirstEventCard();
	game.addCardDraw({player});
	player.getCard(first);
	game.turnContext = null;
	player.changeTurnState(ETurnState.inOffenseTrade);
}
