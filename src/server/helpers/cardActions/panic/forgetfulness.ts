import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ETurnState} from 'shared/enum/player';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ENotificationAction} from 'shared/enum/notifications';

import {ETurnContextType} from 'shared/enum/turnContextType';
import INotificationAction from 'shared/interfaces/notification';
import {formatCards, getDiscardableCards} from 'server/helpers/cardHelpers';
import {debugLog} from 'server/helpers/util';
import {EGameLogType} from 'shared/enum/gameLogType';

// Сколько карт меняет забывчивость. Меньше просим только у того, кому нечем
// платить: карту «Нечто» и единственное заражение сбросить нельзя, а требовать
// третью карту у того, у кого её нет, — значит повесить ход навсегда.
export const forgetfulnessCardsCount = 3;

export const notifyPlayerDiscardCards = ({game, player}: {game:Game, player:Player}) : INotificationAction => {
	const filteredCards = getDiscardableCards({game, player});
	const count = Math.min(forgetfulnessCardsCount, filteredCards.length);

	return {
		type: ENotificationAction.selectCards,
		cards: formatCards(filteredCards),
		count,
		text: `Выбери ${count} карты для сброса и возьми ${count} новые из колоды`,
	}
};

export const forgetfullnessAct = ({game, player}: {game:Game, player:Player}) => {
	game.addLog('Паника! Забывчивость: Игрок меняет три карты с руки на три из колоды', EGameLogType.panic);
	player.changeTurnState(ETurnState.inCardActionProgress);


	player.notify(formatPlayerNotification({
		player,
		notification: notifyPlayerDiscardCards({game, player})
	}));


	game.turnContext = {
		type: ETurnContextType.forgetfullnessSelect,
		playerId: player.id,
		cards: [],
	}
};


// Весь обмен разом: игрок отмечает карты галочками в одном окне и подтверждает
// их вместе, поэтому и меняем всё одним шагом — сколько отдал, столько и взял.
export const forgetfullnessSelect = ({game, cardUniqueIds, player}: {game:Game, player: Player, cardUniqueIds: string[]}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.forgetfullnessSelect) {
		throw new Error('Забывчивость зафакапилась')
	}
	debugLog('FORGORFULLNESS SELECT')
	game.turnContext.cards = [...cardUniqueIds];
	cardUniqueIds.forEach(cardUniqueId => player.discardCard(cardUniqueId));

	const newCards = cardUniqueIds.map(() => game.pickFirstEventCard());
	game.addCardDraw({player, count: newCards.length});
	newCards.forEach(card => player.getCard(card));

	game.turnContext = null;
	player.changeTurnState(ETurnState.inOffenseTrade)
}
