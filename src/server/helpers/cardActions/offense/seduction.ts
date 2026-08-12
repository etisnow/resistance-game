import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';
import {EGameLogType} from 'shared/enum/gameLogType';
import {EEventID} from 'shared/enum/cards';

export const seductionAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	player.changeTurnState(ETurnState.inCardActionProgress);
	const allPlayersExeptCurrent = player.getAllPlayablePlayersExceptCurrent();
	if (!card.uniqueId) return;
	game.turnContext = {
		type: ETurnContextType.seduction,
		offensePlayer: player,
		defensePlayer: null,
		cardUniqueId: card.uniqueId,
	};
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: allPlayersExeptCurrent,
		text: 'Выбри с кем хочешь поменяться картами'
      },
    }));
    game.addLog(`Игрок ${player.nickname} играет Соблазн`, EGameLogType.card);
};

export const seductionSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (!game.turnContext) return
	switch (game.turnContext.type) {
		case ETurnContextType.seduction:
		case ETurnContextType.friendshipSeduction:
			// Тем же выбором игрока приходит и «Давай дружить?»: карта там другая
			// (паника), и выдавать её за «Соблазн» нельзя. Держим сам контекст, а не
			// флаг: по нему тип сужается, и ниже видно поля именно «Соблазна».
			const seductionContext = game.turnContext.type === ETurnContextType.seduction ? game.turnContext : null;
			if (seductionContext) {
				player.discardCard(seductionContext.cardUniqueId);
			}
			const playerToTrade = game.players[selectedPlayerId];
			if (!playerToTrade) return;
			if (player === playerToTrade) {
				game.turnContext = null;
				game.endTurn(player.id);
				return;
			}
			game.turnContext = {
				type: ETurnContextType.trade,
				offensePlayer: player,
				defensePlayer: playerToTrade,
				offenseCard: null,
				defenseCard: null,
			};
		    game.addLog(`Игроки ${player.nickname} и ${playerToTrade.nickname} меняются картами`, EGameLogType.trade);
			// Событие применения — здесь, а не в seductionAct: до выбора игрока карту
			// можно отменить (см. isPlayerCanCancel), и на столе прозвучал бы и
			// всплыл «Соблазн», которого не было. Так же поступают топор, анализ,
			// карантин и подозрение — все прицельные карты.
			if (seductionContext) game.addCardEffect({cardId: EEventID.seduction, player, target: playerToTrade});
			//playerToTrade.changeTurnState(ETurnState.inDefenseTrade);
			player.changeTurnState(ETurnState.inOffenseTrade)
	}


};
