import {Player} from 'server/models/Player';
import {EPlayerState, ETurnState} from 'shared/enum/player';
import {ENotification} from 'shared/enum/notifications';
import {getCard} from 'shared/constant/cards';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ECardType, EEventID} from 'shared/enum/cards';
import {Game} from 'server/models/Game';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {seductionTradeFinish} from 'server/helpers/cardActions/offense/seduction';
import {discardCard} from 'server/helpers/discardCard';

export const tradeCard = ({game, player, cardUniqueId}: {game: Game, player: Player, cardUniqueId: string}) => {
  const tradingCard = player.getCardByUniqueId(cardUniqueId);
  if (tradingCard.type !== ECardType.event) {
    throw new Error(`Попытка обменяться НЕ картой эвента ${tradingCard}`);
  }

  const isOffenseTrade = player.turnState === ETurnState.inOffenseTrade;
  const context = game.turnContext;
  let playerToTrade: Player | null =  null;
  if (context && context.type === ETurnContextType.trade && context.defensePlayer) {
    playerToTrade = context.defensePlayer
  } else {
    playerToTrade = game.getPlayerByPosition({playerId: player.id, isNext: isOffenseTrade});
  }

  if (isOffenseTrade) {
    if (playerToTrade.state === EPlayerState.door) {
      game.addLog(`Игрок ${player.nickname} не меняется из-за заколоченной двери`);
      //const playerCard = getCard((context as any).offenseCardId);
      //player.hand.push(playerCard);
      game.endTurn(player.id);
      return
    }
    discardCard({player, cardUniqueId, game});
    playerToTrade.changeTurnState(ETurnState.inDefenseTrade);
    player.changeTurnState(ETurnState.idle);
    game.addLog(`Игрок ${player.nickname} передает карту для обмена игроку ${playerToTrade.nickname}`);
    game.turnContext = {
      type: ETurnContextType.trade,
      defensePlayer: playerToTrade,
      offensePlayer: player,
      offenseCardId: tradingCard.id,
    };
    return;
  }
  discardCard({player, cardUniqueId, game});
  //isDefense trade
  if (context.type !== ETurnContextType.trade) {
    console.error('Нет выбранной карты для обмена у игрока', player.id);
    return;
  }
  let offensePlayer = context.offensePlayer;
  let defensePlayer = context.defensePlayer;
  offensePlayer.changeTurnState(ETurnState.idle);
  game.addLog(`Игроки ${player.nickname} и ${offensePlayer.nickname} обменялись картами`);



  const offensePlayerCard = getCard(context.offenseCardId);
  const defensePlayerCard = tradingCard;
  /* OFFENSE CARD PUSH */
  offensePlayer.hand.push(defensePlayerCard);
  offensePlayer.notify(formatPlayerNotification({
    player: player,
    notification: {
      type: ENotification.okayCard,
      cards: [offensePlayerCard],
      text: `Игрок ${player.nickname} дал эту карту`,
    },
  }));
  if (defensePlayerCard.id=== EEventID.injure) {
    game.injurePlayer(offensePlayer.id);
  }

  /* DEFENSE CARD PUSH */
  player.hand.push(offensePlayerCard);
  player.notify(formatPlayerNotification({
    player: player,
    notification: {
      type: ENotification.okayCard,
      cards: [offensePlayerCard],
      text: `Игрок ${offensePlayer.nickname} дал эту карту`,
    },
  }));
  if (offensePlayerCard.id=== EEventID.injure) {
    game.injurePlayer(player.id);
  }


  if (game.turnContext && game.turnContext.type === ETurnContextType.seduction) {
    return seductionTradeFinish({game})
  }
  game.endTurn(offensePlayer.id);
  //game.changeTurn(player.id)
  game.turnContext = null;

};
