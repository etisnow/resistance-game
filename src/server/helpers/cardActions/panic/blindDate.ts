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

// Свидание вслепую меняет одну карту — то же окно выбора, что и у забывчивости,
// только отметить в нём просят одну карту.
export const notifyPlayerBlindDateCard = ({game, player}: {game:Game, player:Player}) : INotificationAction => ({
	type: ENotificationAction.selectCards,
	cards: formatCards(getDiscardableCards({game, player})),
	count: 1,
	text: 'Выбери карту для сброса и возьми новую из колоды',
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


export const blindDateSelect = ({game, cardUniqueIds, player}: {game:Game, player: Player, cardUniqueIds: string[]}) => {
	const [cardUniqueId] = cardUniqueIds;
	if (!cardUniqueId) return;
	debugLog('BLIND DATE CARD UNIQUE', cardUniqueId);
	player.discardCard(cardUniqueId);
	const first = game.pickFirstEventCard();
	game.addCardDraw({player});
	player.getCard(first);
	game.turnContext = null;
	player.changeTurnState(ETurnState.inOffenseTrade);
}
