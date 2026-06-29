import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {filter} from 'lodash';
import {ETurnState} from 'shared/enum/player';

export const threeFourAct = ({game, player}: {game:Game, player:Player}) => {
	game.addLog('Паника: Все карты "Заколоченная дверь" сбрасываются');
	game.playersList = filter(game.playersList, pId => {
		const pl = game.players[pId];
		return pl?.isAlive() ?? false;
	});
	player.changeTurnState(ETurnState.inOffenseTrade);
};
