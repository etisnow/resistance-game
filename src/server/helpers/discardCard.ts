import {Player} from 'server/models/Player';
import {Game} from 'server/models/Game';
import {ETurnState} from 'shared/enum/player';

/*export const discardCard = ({game, player, cardUniqueId}: {game: Game, player: Player, cardUniqueId: string}) => {
  const discardCardIndex = findIndex(player.hand, (card) => card.uniqueId === cardUniqueId);
  game.discardedDeckPush(player.getCardByUniqueId(cardUniqueId));
  player.hand.splice(discardCardIndex, 1);
};*/

export const discardCardAction = ({game, player, cardUniqueId}: {game: Game, player: Player, cardUniqueId: string}) => {
  //discardCard({game, player, cardUniqueId});
  game.addLog(`Игрок ${player.nickname} сбросил карту и меняется картами`);
  player.discardCard(cardUniqueId);
  player.changeTurnState(ETurnState.inOffenseTrade);
};


