import {Game} from 'server/models/Game';
import {Player} from 'server/models/Player';
import {ENotificationAction} from 'shared/enum/notifications';
import {formatPlayerNotification} from 'server/formatters/formatOutgoingEvents';
import {ETurnContextType} from 'shared/enum/turnContextType';
import {ICardEvent} from 'shared/interfaces/cards';
import {ETurnState} from 'shared/enum/player';

import {EEventID} from 'shared/enum/cards';
import {find} from 'lodash';
import {EGameLogType} from 'shared/enum/gameLogType';

export const positionswapAct = ({card, game, player} : {card:ICardEvent, game: Game, player: Player}) => {
	if (!card.uniqueId) return;
	game.turnContext = {
		type: ETurnContextType.positionswap,
		offensePlayer: player,
		defensePlayer: null,
		cardUniqueId: card.uniqueId,
		cardId: EEventID.positionswap,
	};

	player.changeTurnState(ETurnState.inCardActionProgress);
    player.notify(formatPlayerNotification({
      player: player,
      notification: {
		type: ENotificationAction.playerSelect,
		playersToSelect: player.getPlayabeNeighbours(),
		text: 'Выбери с кем хочешь поменяться местами'
      },
    }));
};

export const positionswapSelect = ({game, player, selectedPlayerId} : {game: Game, player: Player, selectedPlayerId:string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.positionswap) {
		throw new Error('Смена места произошла без контекста positionswap');
	}
	player.discardCard(game.turnContext.cardUniqueId);
	const defensePlayer = game.players[selectedPlayerId];
	if (!defensePlayer) return;
	game.turnContext = {
		type: ETurnContextType.positionswap,
		offensePlayer: player,
		defensePlayer: defensePlayer,
		cardUniqueId: game.turnContext.cardUniqueId,
		cardId: game.turnContext.cardId,
	};
    const hasLeaveMeAloneCard = !!find(defensePlayer.hand, {id: EEventID.leaveMeAlone});
    let text = `Игрок ${player.nickname} предлагает поменяться местами`
    let decisionMenu = [{
		text: 'Поменяться',
		action: 'swap',
	}]
	if (hasLeaveMeAloneCard) {
		decisionMenu.push({
			text: 'Отказаться от обмена местами',
			action: 'cancelSwap',
		})
		text = `Игрок ${player.nickname} предлагает поменяться местами, но у тебя есть "Мне и здесь неплохо"`
	}
    defensePlayer.notify(formatPlayerNotification({
		player: player,
		notification: {
			type: ENotificationAction.actionDecision,
			text,
			menu: decisionMenu
		},
    }));
	game.addLog(`Игрок ${player.nickname} предложил смену мест игроку ${defensePlayer.nickname}`, EGameLogType.card);
	player.changeTurnState(ETurnState.idle)
};


export const positionswapFinish = ({game, player, action}: {game:Game, player:Player, action:string}) => {
	if (!game.turnContext || game.turnContext.type !== ETurnContextType.positionswap) {
		throw new Error('Смена места произошла без контекста positionswap');
	}
	const {offensePlayer, defensePlayer} = game.turnContext;
	game.turnContext = null;
	if (!defensePlayer) return;

	const leaveMeAloneCard = find(player.hand, {id:EEventID.leaveMeAlone});
	if (action === 'swap' || !leaveMeAloneCard) {
		game.addLog(`Игроки ${offensePlayer.nickname} и ${defensePlayer.nickname} меняются местами`, EGameLogType.card);
		game.swapPlayers(offensePlayer.id, defensePlayer.id);
		offensePlayer.changeTurnState(ETurnState.inOffenseTrade);
		return;
	}
	//КЕЙС КОГДА ИГРОК ПРИМЕНИЛ КАРТУ LEAVEME ALONE
	game.addLog(`Игрок ${defensePlayer.nickname} применил "Мне и здесь неплохо" и остался на месте`, EGameLogType.card);
	game.addCardEffect({cardId: EEventID.leaveMeAlone, player: defensePlayer, target: offensePlayer});
	//discardCard({game, player, cardUniqueId: leaveMeAloneCard.uniqueId});
	if (leaveMeAloneCard.uniqueId) {
		player.discardCard(leaveMeAloneCard.uniqueId)
	}

	game.grabEventCardFromDeck({player});
	offensePlayer.changeTurnState(ETurnState.inOffenseTrade);

}
