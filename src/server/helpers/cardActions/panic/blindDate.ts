import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ETurnState} from 'shared/enum/player';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ENotification} from 'shared/enum/notifications';
import {clone, find} from 'lodash';
import {formatCardActions} from 'server/formatters/formatCardActions';
import {EPlayerActionType} from 'shared/enum/playerActions';
import {discardCard} from 'server/helpers/discardCard';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {notifyPlayerDiscardCards} from 'server/helpers/cardActions/panic/forgetfulness';

export const blindDateAct = ({game, player}: {game:Game, player:Player}) => {
	game.addLog('Игрок меняет одну карту с руки на карту из колоды');
	player.changeTurnState(ETurnState.inCardActionProgress);
	notifyPlayerDiscardCards({game, player})
	game.turnContext = {
		type: ETurnContextType.blindDateCardSelect,
		playerId: player.id,
	}
};


export const blindDateSelect = ({game, cardUniqueId, player}: {game:Game, player: Player, cardUniqueId: string}) => {
	discardCard({game, player, cardUniqueId: cardUniqueId});
	const first = game.pickFirstEventCard();
	player.hand.push(first);
	game.turnContext = null;
	game.endTurn(player.id);
}
