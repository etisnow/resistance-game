import {Player} from 'server/models/Player';
import {Game} from 'server/models/Game';
import {ETurnState} from 'shared/enum/player';
import {EGameLogType} from 'shared/enum/gameLogType';

/*export const discardCard = ({game, player, cardUniqueId}: {game: Game, player: Player, cardUniqueId: string}) => {
  const discardCardIndex = findIndex(player.hand, (card) => card.uniqueId === cardUniqueId);
  game.discardedDeckPush(player.getCardByUniqueId(cardUniqueId));
  player.hand.splice(discardCardIndex, 1);
};*/

export const discardCardAction = ({game, player, cardUniqueId}: {game: Game, player: Player, cardUniqueId: string}) => {
  //discardCard({game, player, cardUniqueId});
  game.addLog(`Игрок ${player.nickname} сбросил карту`, EGameLogType.card);
  player.discardCard(cardUniqueId);
  player.changeTurnState(ETurnState.inOffenseTrade);
};


