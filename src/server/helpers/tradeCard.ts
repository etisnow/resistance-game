import {findIndex} from 'lodash';
import {Player} from 'server/models/Player';
import {ETurnState} from 'shared/enum/player';
import {ENotification} from 'shared/enum/notifications';
import {getCard} from 'shared/constant/cards';
import {ICard} from 'shared/interfaces/cards';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {EEventID} from 'shared/enum/cards';
import {Game} from 'server/models/Game';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {soblaznTradeFinish} from 'server/helpers/cardActions/soblazn';
import {discardCard} from 'server/helpers/discardCard';

export const tradeCard = ({game, player, cardUniqueId}: {game: Game, player: Player, cardUniqueId: string}) => {
  const tradingCard = player.getCardByUniqueId(cardUniqueId);
  discardCard({player, cardUniqueId, game});
  const isOffenseTrade = player.turnState === ETurnState.inOffenseTrade;
  const context = game.turnContext;
  let nextPlayer =  null;
  if (context && context.type === ETurnContextType.soblazn) {
    nextPlayer = game.players[context.playerIdToTrade]
  } else {
    nextPlayer = game.getPlayerByPosition({playerId: player.id, isNext: isOffenseTrade});
  }

  if (isOffenseTrade) {
    nextPlayer.changeTurnState(ETurnState.inDefenseTrade);
    player.changeTurnState(ETurnState.idle);
    game.addLog(`Игрок ${player.nickname} передает карту для обмена игроку ${nextPlayer.nickname}`);
    game.cardChangeId = tradingCard.id;
    return;
  }
  //isDefense trade
  if (!game.cardChangeId) {
    console.error('Нет выбранной карты для обмена у игрока', player.id);
    return;
  }
  let prevPlayer = null;
  if (context && context.type === ETurnContextType.soblazn) {
    prevPlayer = game.players[context.playerId]
  } else {
    prevPlayer = game.getPlayerByPosition({playerId: player.id, isNext: isOffenseTrade});
  }

  prevPlayer.changeTurnState(ETurnState.idle);
  game.addLog(`Игроки ${player.nickname} и ${prevPlayer.nickname} обменялись картами`);

  const prevPlayerCard = getCard(tradingCard.id)
  prevPlayer.hand.push(prevPlayerCard);
  prevPlayer.notify(formatPlayerNotification({
    player: player,
    notification: {
      type: ENotification.okayCard,
      cards: [prevPlayerCard],
      text: `Игрок ${player.nickname} дал эту карту`,
    },
  }));

  const playerCard = getCard(game.cardChangeId);
  player.hand.push(playerCard);
  player.notify(formatPlayerNotification({
    player: player,
    notification: {
      type: ENotification.okayCard,
      cards: [playerCard],
      text: `Игрок ${prevPlayer.nickname} дал эту карту`,
    },
  }));

  if (game.cardChangeId === EEventID.zarazhenie) {
    game.injurePlayer(player.id);
  }
  game.cardChangeId = null;
  if (game.turnContext && game.turnContext.type === ETurnContextType.soblazn) {
    return soblaznTradeFinish({game})
  }
  game.changeTurn(player.id)

};
