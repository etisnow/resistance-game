import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotification} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';

export const oopsAct = ({game, player} : {game: Game, player: Player}) => {
    game.notifyAllPlayers(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotification.okayCard,
        cards: player.hand as ICardEvent[],
		text: `${player.nickname}: УУУПС!`
      },
    }));
    game.addLog(`${player.nickname} как бы случайно показывает все карты.`)
	player.changeTurnState(ETurnState.inOffenseTrade);
};
